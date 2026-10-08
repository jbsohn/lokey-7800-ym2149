// Consolidated PCB build pipeline:
//   Phase 1 (Build & Route):      tsci build -> createDsn() -> Freerouting CLI -> mergeSesToCircuitJson()
//   Phase 2 (KiCad Export & Prep): tsci export -> .kicad_pro & .kicad_dru rules -> kicadts AST fixups
//   Phase 3 (DRC Gate):           kicad-cli (zone refill + JSON DRC gate)
//   Phase 4 (Package):            kicad-cli (gerbers, drill) -> .gbrjob metadata -> zip validation
//
// Usage:
//   bun build-pcb.ts <board>.circuit.tsx [--check]
//
//   --check stops after the DRC gate (writes to build/check, skips gerbers/drill packaging).

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { parseKicadPcb, TitleBlock, type KicadPcb, type TextEffects } from "kicadts";
import type { AnyCircuitElement, PcbBoard } from "circuit-json";
import { createDsn, mergeSesToCircuitJson } from "./dsn-adapter";

process.chdir(dirname(fileURLToPath(import.meta.url)));

// --- CLI Arguments & Paths ----------------------------------------------------

const CHECK_ONLY = process.argv.includes("--check");
const entry = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!entry) {
  console.error("usage: bun build-pcb.ts <board>.circuit.tsx [--check]");
  process.exit(1);
}

const board = basename(entry).split(".")[0];
const BUILD = CHECK_ONLY ? "build/check" : "build";
const TS_DIR = join(BUILD, "tscircuit");
const KICAD_DIR = join(BUILD, "KiCad");
const PCB = join(KICAD_DIR, "index.kicad_pcb");
const PRO = join(KICAD_DIR, "index.kicad_pro");
const DRU = join(KICAD_DIR, "index.kicad_dru");
const DRC_JSON = join(BUILD, "index-drc.json");
const GERBER_DIR = join(BUILD, "gerbers");

// Fab & Design Constants
const MIN_TEXT_MM = 0.8;
const MIN_TEXT_THICKNESS_MM = 0.1;
const GND_ZONE_MIN_THICKNESS_MM = 0.15;
const REVISION = "Rev1";
const FINISH = "ENIG";

// Board design rules declared on <board>
interface BoardRules {
  minTrace?: number;
  viaPad?: number;
  viaHole?: number;
  edge?: number;
}

// KiCad 10 DRC types (https://schemas.kicad.org/drc.v1.json)
interface DrcItem {
  description?: string;
}

interface DrcViolation {
  type?: string;
  description?: string;
  items?: DrcItem[];
}

interface DrcReport {
  violations?: DrcViolation[];
  unconnected_items?: DrcViolation[];
  included_severities?: string[];
  ignored_checks?: Array<{ key?: string }>;
}

const UNTYPED = "untyped";

// DRC categories that indicate true board failure (not cosmetic silkscreen/library noise)
const HARD_DRC = new Set([
  "shorting_items",
  "clearance",
  "hole_clearance",
  "hole_to_hole",
  "track_width",
  "via_diameter",
  "annular_width",
  "drill_out_of_range",
  "copper_edge_clearance",
]);

const REQUIRED_FAB_SUFFIXES = [
  "-F_Cu.gtl",
  "-B_Cu.gbl",
  "-F_Mask.gts",
  "-B_Mask.gbs",
  "-F_Silkscreen.gto",
  "-B_Silkscreen.gbo",
  "-Edge_Cuts.gm1",
  ".drl",
  "-job.gbrjob",
] as const;

// --- Subprocess & Tool Discovery Helpers --------------------------------------

function run(cmd: string, args: string[], quiet = true) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: quiet ? "pipe" : "inherit",
    maxBuffer: 1 << 28,
  });
  if (r.error) throw r.error;
  return r;
}

function freeroutingCommand(): { cmd: string; args: string[] } {
  const javaBin = (() => {
    if (process.env.JAVA_BIN) return process.env.JAVA_BIN;
    if (process.env.JAVA_HOME && existsSync(join(process.env.JAVA_HOME, "bin/java"))) {
      return join(process.env.JAVA_HOME, "bin/java");
    }
    const macJvms = [
      "/Library/Java/JavaVirtualMachines/microsoft-25.jdk/Contents/Home/bin/java",
      "/opt/homebrew/opt/openjdk/bin/java",
    ];
    for (const p of macJvms) {
      if (existsSync(p)) return p;
    }
    return "java";
  })();

  const defaultJar = join(dirname(fileURLToPath(import.meta.url)), ".tools", "freerouting-2.4.1.jar");
  const jar = process.env.FREEROUTING_JAR ?? (existsSync(defaultJar) ? defaultJar : undefined);
  if (jar) {
    if (!existsSync(jar)) throw new Error(`FREEROUTING_JAR is set but not found: ${jar}`);
    return { cmd: javaBin, args: ["-Djava.awt.headless=true", "-jar", jar] };
  }
  const bin = process.env.FREEROUTING_BIN ?? "freerouting";
  if (spawnSync("which", [bin], { stdio: "ignore" }).status === 0 || existsSync(bin)) {
    return { cmd: bin, args: [] };
  }
  throw new Error(
    "freerouting not found: set FREEROUTING_JAR to a freerouting-*.jar (run via java -jar) or FREEROUTING_BIN to an executable",
  );
}

const KICAD_CLI = (() => {
  if (process.env.KICAD_CLI) return process.env.KICAD_CLI;
  const mac = "/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli";
  if (spawnSync("kicad-cli", ["version"], { stdio: "ignore" }).error && existsSync(mac)) return mac;
  return "kicad-cli";
})();

function requireKicad10(): void {
  const version = run(KICAD_CLI, ["version"]).stdout.trim();
  const major = Number(version.split(".")[0]);
  if (Number.isNaN(major) || major < 10) {
    throw new Error(
      `KiCad 10 or newer is required (found ${version || "no kicad-cli"}): 'kicad-cli pcb drc --refill-zones --save-board' does not exist before 10.`,
    );
  }
}

function kicad(args: string[]) {
  const r = run(KICAD_CLI, args);
  if (r.status !== 0) {
    throw new Error(`kicad-cli ${args.slice(0, 3).join(" ")} failed:\n${r.stderr || r.stdout}`);
  }
  return r;
}

// ==============================================================================
// Phase 1: Build & Route
// ==============================================================================

function buildAndRoute(): { path: string; rules: BoardRules } {
  console.log(`Phase 1: Building unrouted circuit JSON for ${entry}...`);
  const distDir = join("dist", board);
  rmSync(distDir, { recursive: true, force: true });
  const build = run("bunx", ["tsci", "build", entry!]); // exits non-zero while unrouted

  const builtJson = join(distDir, "circuit.json");
  if (!existsSync(builtJson)) {
    throw new Error(`tsci build did not produce ${builtJson}:\n${build.stderr || build.stdout}`);
  }
  const circuitJson: AnyCircuitElement[] = JSON.parse(readFileSync(builtJson, "utf8"));

  console.log("Routing with freerouting...");
  mkdirSync(TS_DIR, { recursive: true });
  const dsn = createDsn(circuitJson);
  const dsnPath = join(TS_DIR, `${board}.dsn`);
  const sesPath = join(TS_DIR, `${board}.ses`);
  writeFileSync(dsnPath, dsn);

  const extra = (process.env.FREEROUTING_ARGS ?? "-mt 0").split(" ").filter(Boolean);
  const freerouting = freeroutingCommand();
  const fr = run(freerouting.cmd, [
    ...freerouting.args,
    "-de",
    dsnPath,
    "-do",
    sesPath,
    "--gui.enabled=false",
    ...extra,
  ]);
  if (fr.status !== 0 || !existsSync(sesPath)) {
    throw new Error(`freerouting failed:\n${fr.stderr || fr.stdout}`);
  }

  const frDrcPath = join(TS_DIR, `${board}-drc.json`);
  const frDrcRun = run(freerouting.cmd, [
    ...freerouting.args,
    "-de",
    `${dsnPath}+${sesPath}`,
    "-drc",
    frDrcPath,
    "--gui.enabled=false",
  ]);
  if (frDrcRun.status !== 0 || !existsSync(frDrcPath)) {
    throw new Error(`freerouting -drc failed:\n${frDrcRun.stderr || frDrcRun.stdout}`);
  }

  const frDrc = JSON.parse(readFileSync(frDrcPath, "utf8"));
  const unconnected = frDrc.unconnected_items ?? frDrc.unconnectedItems;
  if (!Array.isArray(unconnected)) {
    throw new Error(`freerouting -drc JSON has no unconnected_items array: ${frDrcPath}`);
  }
  if (unconnected.length > 0) {
    throw new Error(`freerouting left ${unconnected.length} unconnected item(s) (see ${frDrcPath})`);
  }

  const ses = readFileSync(sesPath, "utf8");
  const routedCircuitJson = mergeSesToCircuitJson(dsn, ses, circuitJson);

  const outPath = join(TS_DIR, `${board}.routed.circuit.json`);
  writeFileSync(outPath, JSON.stringify(routedCircuitJson));

  const nTraces = routedCircuitJson.filter((e) => e.type === "pcb_trace").length;
  const nVias = routedCircuitJson.filter((e) => e.type === "pcb_via").length;
  console.log(`  ${nTraces} traces, ${nVias} vias`);

  const boardElement = circuitJson.find((e): e is PcbBoard => e.type === "pcb_board");
  return {
    path: outPath,
    rules: {
      minTrace: boardElement?.min_trace_width,
      viaPad: boardElement?.min_via_pad_diameter,
      viaHole: boardElement?.min_via_hole_diameter,
      edge: boardElement?.min_board_edge_clearance,
    },
  };
}

// ==============================================================================
// Phase 2: KiCad Export & Prep
// ==============================================================================

function applyBoardAstFixups(): void {
  const pcb = parseKicadPcb(readFileSync(PCB, "utf8")) as KicadPcb;

  // Clamp reference designator text size and thickness to fab minimums
  let textUpdates = 0;
  const clampFont = (effects?: TextEffects) => {
    const font = effects?.font;
    if (font?.size && font.size.height < MIN_TEXT_MM) {
      font.size = { width: MIN_TEXT_MM, height: MIN_TEXT_MM };
      font.thickness = MIN_TEXT_THICKNESS_MM;
      textUpdates++;
    }
  };

  for (const fp of pcb.footprints) {
    for (const t of fp.fpTexts) {
      if (t.type === "reference") clampFont(t.effects);
    }
    for (const p of fp.properties) {
      if (p.key === "Reference") clampFont(p.effects);
    }
  }

  // Set minimum thickness on GND zones
  let zoneUpdates = 0;
  for (const z of pcb.zones) {
    if (z.netName === "GND") {
      z.minThickness = GND_ZONE_MIN_THICKNESS_MM;
      zoneUpdates++;
    }
  }

  // Ensure title block revision
  if (pcb.titleBlock) {
    pcb.titleBlock.rev = REVISION;
  } else {
    pcb.titleBlock = new TitleBlock({ rev: REVISION });
  }

  writeFileSync(PCB, pcb.getString());
  console.log(
    `  Fixed text size on ${textUpdates} reference designator(s); ${zoneUpdates} GND zone(s) min thickness ${GND_ZONE_MIN_THICKNESS_MM}mm; revision ${REVISION}`,
  );
}

function writeProjectAndCustomRules(rules: BoardRules): void {
  const viaPad = rules.viaPad ?? 0.3;
  const viaHole = rules.viaHole ?? 0.2;

  const pro = {
    meta: { filename: "index.kicad_pro", version: 1 },
    board: {
      design_settings: {
        rules: {
          min_track_width: rules.minTrace ?? 0.15,
          min_via_diameter: viaPad,
          min_through_hole_diameter: viaHole,
          min_via_annular_width: (viaPad - viaHole) / 2,
          min_copper_edge_clearance: rules.edge ?? 0.2,
        },
        rule_severities: {
          lib_footprint_issues: "ignore",
          text_height: "ignore",
          text_thickness: "ignore",
          // The right-shoulder GND pour leaves small isolated fills that KiCad reports as zone-to-zone
          // "unconnected"; real GND connectivity is through the component leads. Non-GND items still fail below.
          unconnected_items: "warning",
        },
      },
    },
  };
  writeFileSync(PRO, JSON.stringify(pro, null, 2));

  // Custom rules: J1 card edge clearance and escape clearances through connector notch
  const dru = `(version 1)

# Board copper clearance (standard 0.15mm / 6 mil)
(rule "board_clearance"
  (constraint clearance (min 0.15mm))
)

# J1 is an Atari 7800 card-edge connector — pads intentionally sit at the board edge.
(rule "J1_card_edge_clearance"
  (constraint edge_clearance (min 0mm))
  (condition "A.Reference == 'J1' || B.Reference == 'J1'")
)

# HALT, PHI2, RW, A13, A14 must escape through the narrow connector notch.
(rule "connector_notch_escape_clearance"
  (constraint edge_clearance (min 0mm))
  (condition "A.NetName == 'HALT' || B.NetName == 'HALT' || A.NetName == 'PHI2' || B.NetName == 'PHI2' || A.NetName == 'RW' || B.NetName == 'RW' || A.NetName == 'A13' || B.NetName == 'A13' || A.NetName == 'A14' || B.NetName == 'A14'")
)
`;
  writeFileSync(DRU, dru);
}

function exportAndPrep(routedJsonPath: string, rules: BoardRules): void {
  console.log("Phase 2: Exporting KiCad board and configuring project...");
  mkdirSync(KICAD_DIR, { recursive: true });
  const r = run("bunx", ["tsci", "export", routedJsonPath, "-f", "kicad_pcb", "-o", resolve(PCB)]);
  if (r.status !== 0 || !existsSync(PCB)) {
    throw new Error(`tsci export failed:\n${r.stderr || r.stdout}`);
  }

  writeProjectAndCustomRules(rules);
  applyBoardAstFixups();
}

// ==============================================================================
// Phase 3: DRC Gate
// ==============================================================================

function isGndZoneFill(entry: DrcViolation): boolean {
  const items = entry.items;
  if (!items?.length) return false;
  return items.every((i) => (i.description ?? "").includes("Zone [GND]"));
}

function drcGate(): void {
  console.log("Phase 3: Refilling zones and running KiCad DRC gate...");
  kicad([
    "pcb",
    "drc",
    "--format",
    "json",
    "--severity-error",
    "--severity-warning",
    "--refill-zones",
    "--save-board",
    "-o",
    DRC_JSON,
    PCB,
  ]);

  const report = JSON.parse(readFileSync(DRC_JSON, "utf8")) as DrcReport;
  if (!Array.isArray(report.violations) || !Array.isArray(report.unconnected_items)) {
    throw new Error(`KiCad DRC JSON is missing required arrays (https://schemas.kicad.org/drc.v1.json): ${DRC_JSON}`);
  }

  // Ensure DRC covered both error and warning severities
  const severities = report.included_severities ?? [];
  for (const s of ["error", "warning"]) {
    if (!severities.includes(s)) {
      throw new Error(`KiCad DRC JSON did not include '${s}' severity, so the gate would be blind to it: ${DRC_JSON}`);
    }
  }

  // Verify no hard-gated checks were suppressed by rules
  const ignored = (report.ignored_checks ?? []).map((c) => c.key ?? "");
  const blinded = ignored.filter((k) => HARD_DRC.has(k) || k === "unconnected_items");
  if (blinded.length > 0) {
    throw new Error(`KiCad DRC ignores checks the gate depends on (${blinded.join(", ")}); fix rule severities in ${PRO}`);
  }

  const violations = report.violations;
  const unconnected = report.unconnected_items;
  const counts = new Map<string, number>();

  for (const v of violations) {
    const category = v.type ?? UNTYPED;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  const failures: string[] = [];
  const realUnconnected = unconnected.filter((e) => !isGndZoneFill(e));
  if (realUnconnected.length > 0) {
    failures.push(`${realUnconnected.length} unconnected item(s) that are not the GND zone-fill artifact:`);
    for (const e of realUnconnected.slice(0, 6)) {
      const items = e.items ?? [];
      if (!items.length) {
        failures.push(`    ${e.description ?? e.type ?? "unconnected_items"} (no items in report; failing closed)`);
      } else {
        failures.push(...items.map((i) => `    ${i.description ?? ""}`));
      }
    }
  }

  for (const [category, n] of counts) {
    if (category === UNTYPED || HARD_DRC.has(category)) {
      failures.push(`${n} ${category} violation(s)`);
    }
  }

  const noise = [...counts]
    .filter(([c]) => c !== UNTYPED && !HARD_DRC.has(c))
    .map(([c, n]) => `${c}: ${n}`);
  console.log(`  Other DRC notes (cosmetic): ${noise.join(", ") || "none"}`);

  if (failures.length > 0) {
    throw new Error(`DRC failed (see ${DRC_JSON}):\n  ${failures.join("\n  ")}`);
  }
  console.log("  DRC gate passed (no shorts, no real unconnected items, no clearance violations)");
}

// ==============================================================================
// Phase 4: Package
// ==============================================================================

function verifyFabricationOutputs(gerberDir: string): void {
  const files = readdirSync(gerberDir);
  const missing: string[] = [];
  const empty: string[] = [];

  for (const suffix of REQUIRED_FAB_SUFFIXES) {
    const match = files.find((f) => f.endsWith(suffix));
    if (!match) missing.push(suffix);
    else if (statSync(join(gerberDir, match)).size === 0) empty.push(match);
  }

  if (missing.length || empty.length) {
    const errs: string[] = [];
    if (missing.length) errs.push(`Missing layer(s): ${missing.join(", ")}`);
    if (empty.length) errs.push(`Empty layer(s): ${empty.join(", ")}`);
    throw new Error(`Fabrication output verification failed:\n  ${errs.join("\n  ")}`);
  }
}

async function packageFabricationOutputs(): Promise<void> {
  console.log("Phase 4: Exporting Gerbers, drill files, and packaging release...");
  rmSync(GERBER_DIR, { recursive: true, force: true });
  mkdirSync(GERBER_DIR, { recursive: true });
  kicad(["pcb", "export", "gerbers", "--subtract-soldermask", "-o", GERBER_DIR, PCB]);
  kicad(["pcb", "export", "drill", "-o", GERBER_DIR, PCB]);

  const jobPath = join(GERBER_DIR, "index-job.gbrjob");
  if (!existsSync(jobPath)) throw new Error(`Gerber job file was not created: ${jobPath}`);
  const job = JSON.parse(readFileSync(jobPath, "utf8"));
  job.GeneralSpecs.Finish = FINISH;
  job.GeneralSpecs.ProjectId.Revision = REVISION;
  writeFileSync(jobPath, JSON.stringify(job, null, 2));
  console.log(`  Set Finish: ${FINISH}, Revision: ${REVISION}`);

  verifyFabricationOutputs(GERBER_DIR);

  const zip = new JSZip();
  const fabFiles = readdirSync(GERBER_DIR).sort();
  for (const f of fabFiles) {
    zip.file(f, readFileSync(join(GERBER_DIR, f)));
  }
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  if (zipBuffer.length < 5000) {
    throw new Error(`Generated gerber zip is suspiciously small (${zipBuffer.length} bytes); aborting`);
  }
  const zipPath = join(BUILD, "gerbers.zip");
  writeFileSync(zipPath, zipBuffer);
  console.log(`  Zipped ${fabFiles.length} verified Gerber files to ${zipPath} (${zipBuffer.length} bytes)`);

  // Board-specific copies for downstream targets / previews / CI
  copyFileSync(PCB, join(BUILD, `index-${board}.kicad_pcb`));
  copyFileSync(DRC_JSON, join(BUILD, `index-${board}-drc.json`));
  copyFileSync(zipPath, join(BUILD, `gerbers-${board}.zip`));
}

// --- Pipeline Orchestrator ----------------------------------------------------

async function main(): Promise<void> {
  requireKicad10();

  // Phase 1: Build & Route
  const routed = buildAndRoute();

  // Phase 2: KiCad Export & Prep
  exportAndPrep(routed.path, routed.rules);

  // Phase 3: DRC Gate
  drcGate();

  if (CHECK_ONLY) {
    console.log(`\nCheck OK: ${entry} routes cleanly and passes the DRC gate (no gerbers written).`);
    return;
  }

  // Phase 4: Package
  await packageFabricationOutputs();
  console.log("\nSuccess! Fully routed KiCad PCB and Gerbers are updated.");
}

main().catch((err) => {
  console.error(`\nError: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
