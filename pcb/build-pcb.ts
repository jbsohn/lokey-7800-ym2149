// TypeScript build for the tscircuit boards (replaces route_and_patch.py):
//   tsci build -> Specctra DSN -> freerouting -> routed circuit JSON -> KiCad board
//   -> kicadts fixups -> kicad-cli (zone refill + DRC gate, gerbers, drill) -> zip
//
//   FREEROUTING_JAR=~/.local/lib/freerouting-2.4.1.jar bun build-pcb.ts 28pin.circuit.tsx [--check]
//
// --check stops after the DRC gate (writes to build/check, no gerbers).
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { parseKicadPcb, TitleBlock } from "kicadts";
import { convertDsnSessionToCircuitJson, parseDsnToDsnJson, type DsnPcb, type DsnSession } from "dsn-converter";
import { buildDsn } from "./freerouting-dsn";

process.chdir(dirname(fileURLToPath(import.meta.url)));

const CHECK_ONLY = process.argv.includes("--check");
const entry = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!entry) {
  console.error("usage: FREEROUTING_JAR=<freerouting.jar> bun build-pcb.ts <board>.circuit.tsx [--check]");
  process.exit(1);
}

// freerouting: `java -jar $FREEROUTING_JAR`, or a `freerouting` executable ($FREEROUTING_BIN) on PATH.
function freeroutingCommand(): { cmd: string; args: string[] } {
  const jar = process.env.FREEROUTING_JAR;
  if (jar) {
    if (!existsSync(jar)) throw new Error(`FREEROUTING_JAR is set but not found: ${jar}`);
    return { cmd: "java", args: ["-Djava.awt.headless=true", "-jar", jar] };
  }
  const bin = process.env.FREEROUTING_BIN ?? "freerouting";
  if (spawnSync("which", [bin], { stdio: "ignore" }).status === 0 || existsSync(bin)) return { cmd: bin, args: [] };
  throw new Error("freerouting not found: set FREEROUTING_JAR to a freerouting-*.jar (run via java -jar) or FREEROUTING_BIN to an executable");
}

const board = basename(entry).split(".")[0];
const BUILD = CHECK_ONLY ? "build/check" : "build";
const TS_DIR = join(BUILD, "tscircuit");
const KICAD_DIR = join(BUILD, "KiCad");
const PCB = join(KICAD_DIR, "index.kicad_pcb");
const PRO = join(KICAD_DIR, "index.kicad_pro");
const DRU = join(KICAD_DIR, "index.kicad_dru");
const DRC_RPT = join(BUILD, "index-drc.rpt");
const GERBER_DIR = join(BUILD, "gerbers");

const MIN_TEXT_MM = 0.8;
const MIN_TEXT_THICKNESS_MM = 0.1;
const GND_ZONE_MIN_THICKNESS_MM = 0.15;
const REVISION = "Rev1";
const FINISH = "ENIG";

// DRC categories that mean the board is wrong (not cosmetic silkscreen/library noise).
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

function run(cmd: string, args: string[], quiet = true) {
  const r = spawnSync(cmd, args, { encoding: "utf8", stdio: quiet ? "pipe" : "inherit", maxBuffer: 1 << 28 });
  if (r.error) throw r.error;
  return r;
}

const KICAD_CLI = (() => {
  if (process.env.KICAD_CLI) return process.env.KICAD_CLI;
  const mac = "/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli";
  if (spawnSync("kicad-cli", ["version"], { stdio: "ignore" }).error && existsSync(mac)) return mac;
  return "kicad-cli";
})();

function requireKicad10() {
  const version = run(KICAD_CLI, ["version"]).stdout.trim();
  if (Number(version.split(".")[0]) < 10) {
    throw new Error(`KiCad 10 or newer is required (found ${version || "no kicad-cli"}): 'kicad-cli pcb drc --refill-zones --save-board' does not exist before 10.`);
  }
}

function kicad(args: string[]) {
  const r = run(KICAD_CLI, args);
  if (r.status !== 0) throw new Error(`kicad-cli ${args.slice(0, 3).join(" ")} failed:\n${r.stderr || r.stdout}`);
  return r;
}

// Minimums the design itself declares on the <board>; the DRC gate holds the routed board to them.
type BoardRules = { minTrace?: number; viaPad?: number; viaHole?: number; edge?: number };

// --- 1. Route -------------------------------------------------------------------
function route(): { path: string; rules: BoardRules } {
  console.log(`Building unrouted circuit JSON for ${entry}...`);
  const distDir = join("dist", board);
  rmSync(distDir, { recursive: true, force: true });
  run("bunx", ["tsci", "build", entry!]); // exits non-zero while the board is unrouted
  const builtJson = join(distDir, "circuit.json");
  if (!existsSync(builtJson)) throw new Error(`tsci build did not produce ${builtJson}`);
  const circuitJson: any[] = JSON.parse(readFileSync(builtJson, "utf8"));

  console.log("Routing with freerouting...");
  mkdirSync(TS_DIR, { recursive: true });
  const dsn = buildDsn(circuitJson);
  const dsnPath = join(TS_DIR, `${board}.dsn`);
  const sesPath = join(TS_DIR, `${board}.ses`);
  writeFileSync(dsnPath, dsn);
  // `-mt 0` is Freerouting's documented way to disable the (slow, no-gain here) route optimizer.
  const extra = (process.env.FREEROUTING_ARGS ?? "-mt 0").split(" ").filter(Boolean);
  const freerouting = freeroutingCommand();
  const fr = run(freerouting.cmd, [...freerouting.args, "-de", dsnPath, "-do", sesPath, "-mp", "0", "--gui.enabled=false", ...extra]);
  if (fr.status !== 0 || !existsSync(sesPath)) throw new Error(`freerouting failed:\n${fr.stderr}`);
  // >=2.4 logs "(N unrouted and M violations)" per stage; older versions log "session completed: ... (N unrouted)".
  const summary = [...fr.stdout.matchAll(/\((\d+) unrouted and \d+ violations\)/g)].at(-1)?.[1] ?? fr.stdout.match(/session completed:.*?\((\d+) unrouted\)/)?.[1];
  if (summary === undefined) throw new Error("could not find a freerouting completion summary; refusing to use an unverified route");
  if (Number(summary) > 0) throw new Error(`freerouting left ${summary} unrouted connection(s)`);

  const session = parseDsnToDsnJson(readFileSync(sesPath, "utf8")) as DsnSession;
  const routed = convertDsnSessionToCircuitJson(parseDsnToDsnJson(dsn) as DsnPcb, session, circuitJson);
  const traces = routed.filter((e: any) => e.type === "pcb_trace" || e.type === "pcb_via");
  // Every via is a through via; dsn-converter guesses layers from adjacent wires, so a via
  // that ends on the GND plane comes back top->top (invalid in KiCad).
  for (const e of traces as any[]) {
    if (e.type === "pcb_via") Object.assign(e, { from_layer: "top", to_layer: "bottom", layers: ["top", "bottom"] });
    else for (const p of e.route) if (p.route_type === "via") Object.assign(p, { from_layer: "top", to_layer: "bottom" });
  }
  const outPath = join(TS_DIR, `${board}.routed.circuit.json`);
  writeFileSync(outPath, JSON.stringify([...circuitJson.filter((e) => e.type !== "pcb_trace" && e.type !== "pcb_via"), ...traces]));
  const nTraces = traces.filter((e: any) => e.type === "pcb_trace").length;
  console.log(`  ${nTraces} traces, ${traces.length - nTraces} vias`);
  const b = circuitJson.find((e) => e.type === "pcb_board") ?? {};
  return { path: outPath, rules: { minTrace: b.min_trace_width, viaPad: b.min_via_pad_diameter, viaHole: b.min_via_hole_diameter, edge: b.min_board_edge_clearance } };
}

// --- 2. Export + fix up the KiCad board ----------------------------------------------
function exportBoard(routedJson: string) {
  console.log("Exporting KiCad board from tscircuit...");
  mkdirSync(KICAD_DIR, { recursive: true });
  const r = run("bunx", ["tsci", "export", routedJson, "-f", "kicad_pcb", "-o", resolve(PCB)]);
  if (r.status !== 0 || !existsSync(PCB)) throw new Error(`tsci export failed:\n${r.stderr || r.stdout}`);
}

function fixBoard() {
  const pcb: any = parseKicadPcb(readFileSync(PCB, "utf8"));

  // Reference designator text below the fab minimum.
  let texts = 0;
  const bump = (effects: any) => {
    const font = effects?.font;
    if (font?.size && font.size.height < MIN_TEXT_MM) {
      font.size = { width: MIN_TEXT_MM, height: MIN_TEXT_MM };
      font.thickness = MIN_TEXT_THICKNESS_MM;
      texts++;
    }
  };
  for (const fp of pcb.footprints) {
    for (const t of fp.fpTexts) if (t.type === "reference") bump(t.effects);
    for (const p of fp.properties) if (p.key === "Reference") bump(p.effects);
  }

  let zones = 0;
  for (const z of pcb.zones) if (z.netName === "GND") (z.minThickness = GND_ZONE_MIN_THICKNESS_MM), zones++;

  if (pcb.titleBlock) pcb.titleBlock.rev = REVISION;
  else pcb.titleBlock = new TitleBlock({ rev: REVISION });

  writeFileSync(PCB, pcb.getString());
  console.log(`  Fixed text size on ${texts} reference designator(s); ${zones} GND zone(s) min thickness ${GND_ZONE_MIN_THICKNESS_MM}mm; revision ${REVISION}`);
}

function writeProjectFiles(r: BoardRules) {
  const viaPad = r.viaPad ?? 0.3;
  const viaHole = r.viaHole ?? 0.2;
  const pro = {
    meta: { filename: "index.kicad_pro", version: 1 },
    board: {
      design_settings: {
        rules: {
          min_track_width: r.minTrace ?? 0.15,
          min_via_diameter: viaPad,
          min_through_hole_diameter: viaHole,
          min_via_annular_width: (viaPad - viaHole) / 2,
          min_copper_edge_clearance: r.edge ?? 0.2,
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
  writeFileSync(
    DRU,
    `(version 1)

# J1 is an Atari 7800 card-edge connector — pads intentionally sit at the board edge.
(rule "J1_card_edge_clearance"
  (constraint edge_clearance (min 0mm))
  (condition "A.Reference == 'J1' || B.Reference == 'J1'")
)

# HALT, PHI2, RW, A13, A14, VCC, GND must escape through the narrow connector notch.
(rule "connector_notch_escape_clearance"
  (constraint edge_clearance (min 0mm))
  (condition "A.NetName == 'HALT' || B.NetName == 'HALT' || A.NetName == 'PHI2' || B.NetName == 'PHI2' || A.NetName == 'RW' || B.NetName == 'RW' || A.NetName == 'A13' || B.NetName == 'A13' || A.NetName == 'A14' || B.NetName == 'A14' || A.NetName == 'VCC' || B.NetName == 'VCC' || A.NetName == 'GND' || B.NetName == 'GND'")
)
`,
  );
}

// --- 3. Refill zones + DRC gate ----------------------------------------------------------
function parseDrc(report: string) {
  const entries: { category: string; items: string[] }[] = [];
  for (const line of report.split("\n")) {
    const head = line.match(/^\[(\w+)\]:/);
    if (head) entries.push({ category: head[1], items: [] });
    else if (line.trim().startsWith("@(") && entries.length) entries.at(-1)!.items.push(line.trim());
  }
  return entries;
}

function drcGate() {
  console.log("Refilling zones and running DRC...");
  kicad(["pcb", "drc", "--refill-zones", "--save-board", "-o", DRC_RPT, PCB]);
  const entries = parseDrc(readFileSync(DRC_RPT, "utf8"));
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);

  const failures: string[] = [];
  const realUnconnected = entries.filter((e) => e.category === "unconnected_items" && !e.items.every((i) => i.includes("Zone [GND]")));
  if (realUnconnected.length) {
    failures.push(`${realUnconnected.length} unconnected item(s) that are not the GND zone-fill artifact:`);
    for (const e of realUnconnected.slice(0, 6)) failures.push(...e.items.map((i) => `    ${i}`));
  }
  for (const [category, n] of counts) if (HARD_DRC.has(category)) failures.push(`${n} ${category} violation(s)`);

  const noise = [...counts].filter(([c]) => !HARD_DRC.has(c) && c !== "unconnected_items").map(([c, n]) => `${c}: ${n}`);
  console.log(`  Other DRC notes (cosmetic): ${noise.join(", ") || "none"}`);
  if (failures.length) throw new Error(`DRC failed (see ${DRC_RPT}):\n  ${failures.join("\n  ")}`);
  console.log("  DRC gate passed (no shorts, no real unconnected items, no clearance violations)");
}

// --- 4. Fabrication outputs ----------------------------------------------------------------
async function fabricate() {
  console.log("Exporting Gerbers and drill files...");
  rmSync(GERBER_DIR, { recursive: true, force: true });
  mkdirSync(GERBER_DIR, { recursive: true });
  kicad(["pcb", "export", "gerbers", "-o", GERBER_DIR, PCB]);
  kicad(["pcb", "export", "drill", "-o", GERBER_DIR, PCB]);

  const jobPath = join(GERBER_DIR, "index-job.gbrjob");
  if (existsSync(jobPath)) {
    const job = JSON.parse(readFileSync(jobPath, "utf8"));
    job.GeneralSpecs.Finish = FINISH;
    job.GeneralSpecs.ProjectId.Revision = REVISION;
    writeFileSync(jobPath, JSON.stringify(job, null, 2));
    console.log(`  Set Finish: ${FINISH}, Revision: ${REVISION}`);
  } else console.warn("Warning: gbrjob not found");

  const zip = new JSZip();
  for (const f of readdirSync(GERBER_DIR).sort()) zip.file(f, readFileSync(join(GERBER_DIR, f)));
  const zipPath = join(BUILD, "gerbers.zip");
  writeFileSync(zipPath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`  Zipped Gerber files to ${zipPath}`);

  // Board-specific copies so downstream targets (previews, CI artifacts) never grab another board's outputs.
  copyFileSync(PCB, join(BUILD, `index-${board}.kicad_pcb`));
  copyFileSync(DRC_RPT, join(BUILD, `index-${board}-drc.rpt`));
  copyFileSync(zipPath, join(BUILD, `gerbers-${board}.zip`));
}

try {
  requireKicad10();
  const routed = route();
  exportBoard(routed.path);
  fixBoard();
  writeProjectFiles(routed.rules);
  drcGate();
  if (CHECK_ONLY) console.log(`\nCheck OK: ${entry} routes cleanly and passes the DRC gate (no gerbers written).`);
  else {
    await fabricate();
    console.log("\nSuccess! Fully routed KiCad PCB and Gerbers are updated.");
  }
} catch (err) {
  console.error(`\nError: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
