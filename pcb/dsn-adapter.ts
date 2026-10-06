import {
  convertCircuitJsonToDsnString,
  convertDsnSessionToCircuitJson,
  parseDsnToDsnJson,
  type DsnPcb,
  type DsnSession,
} from "dsn-converter";
import type { AnyCircuitElement, PcbBoard, PcbTrace, PcbVia } from "circuit-json";

const MIN_CLEARANCE_UM = 200;

// dsn-converter can emit numbers in scientific notation (e.g. 7.77e-13 from trig rotation).
// Specctra DSN format and freerouting regexes require standard decimal/integer numbers.
function normalizeScientific(dsn: string): string {
  return dsn.replace(/\b-?\d+(?:\.\d+)?[eE][+-]?\d+\b/g, (m) =>
    Math.abs(Number(m)) < 1e-4 ? "0" : String(Number(m)),
  );
}

// dsn-converter keys each footprint image on `ftype + width x height` and reuses one
// part's pins for every part in that group, so same-size parts with different pin
// orientations get each other's pins (freerouting then misses their pads). Make the
// key unique per part so every part gets its own, correct image.
function withUniqueImages(circuitJson: AnyCircuitElement[]): AnyCircuitElement[] {
  return circuitJson.map((e) =>
    e.type === "source_component"
      ? ({ ...e, ftype: `${(e as any).ftype}~${e.source_component_id}` } as unknown as AnyCircuitElement)
      : e,
  );
}

// Pads with no source port (unused pins, e.g. U_YM 2/5/26/39) get their pin id from a
// counter that starts at 1, so they collide with real pins (duplicate ids) and the real
// pads' nets can land on them. Use the number the pad itself carries in `port_hints`.
function fixUnportedPinIds(dsn: string, circuitJson: AnyCircuitElement[]): string {
  const components = new Map(
    circuitJson
      .filter((e) => e.type === "pcb_component")
      .map((e: any) => [e.pcb_component_id, e]),
  );

  for (const pad of circuitJson as any[]) {
    if ((pad.type !== "pcb_plated_hole" && pad.type !== "pcb_smtpad") || pad.pcb_port_id || !pad.pcb_component_id) {
      continue;
    }
    const id = pad.port_hints?.find((h: string) => /^\d+$/.test(h));
    const comp = components.get(pad.pcb_component_id);
    if (!id || !comp) continue;
    const dx = (Number(pad.x.toFixed(3)) - comp.center.x) * 1e3;
    const dy = (Number(pad.y.toFixed(3)) - comp.center.y) * 1e3;
    const image = new RegExp(`\\n {4}\\(image "[^"]*~${comp.source_component_id}:[^"]*"\\n[\\s\\S]*?\\n {4}\\)`);
    dsn = dsn.replace(image, (block) =>
      block.replace(
        /\(pin(\s+\S+\s+(?:\(rotate\s+-?\d+\)\s+)?)(\S+)\s+(-?[\d.]+)\s+(-?[\d.]+)\)/g,
        (whole, head, _old, x, y) =>
          Math.abs(Number(x) - dx) < 0.5 && Math.abs(Number(y) - dy) < 0.5 ? `(pin${head}${id} ${x} ${y})` : whole,
      ),
    );
  }
  return dsn;
}

// Every hand-placed <trace from to> becomes its own 2-pin `Net-(...)` net even when
// both pins already belong to a real net, so those pins sit in two nets at once.
// Drop the duplicates (the real nets keep the connectivity).
function dropDuplicateTraceNets(dsn: string): string {
  const netRe = /\n {4}\(net\s+"?([^"\s]+)"?\s*\n\s*\(pins([^)]*)\)\s*\n\s*\)/g;
  const nets = [...dsn.matchAll(netRe)].map((m) => ({ text: m[0], name: m[1], pins: m[2].trim().split(/\s+/) }));
  const realPins = new Set(nets.filter((n) => !n.name.startsWith("Net-(")).flatMap((n) => n.pins));
  for (const net of nets) {
    if (!net.name.startsWith("Net-(") || !net.pins.every((p) => realPins.has(p))) continue;
    dsn = dsn.replace(net.text, "").split(` "${net.name}"`).join("");
  }
  return dsn;
}

// Pads that belong to no net are not treated as obstacles by freerouting, so tracks
// were routed straight through unused pins. KiCad's own DSN gives every unused pad a
// one-pin net (`unconnected-(REF-PadN)`); do the same.
function addUnconnectedPinNets(dsn: string): string {
  const used = new Set([...dsn.matchAll(/\(pins([^)]*)\)/g)].flatMap((m) => m[1].trim().split(/\s+/)));
  const imagePins = new Map<string, string[]>();
  for (const m of dsn.matchAll(/\n {4}\(image ("[^"]*"|\S+)\n([\s\S]*?)\n {4}\)/g)) {
    const pins = [...m[2].matchAll(/\(pin\s+\S+\s+(?:\(rotate\s+-?\d+\)\s+)?(\S+)\s+-?[\d.]+\s+-?[\d.]+\)/g)].map(
      (p) => p[1],
    );
    imagePins.set(m[1], pins);
  }
  const extra: string[] = [];
  for (const m of dsn.matchAll(/\(component\s+("[^"]*"|\S+)\s*\n((?:\s*\(place[^\n]*\n)+)/g)) {
    for (const place of m[2].matchAll(/\(place\s+"?([^\s"]+)"?/g)) {
      for (const pin of imagePins.get(m[1]) ?? []) {
        if (!used.has(`${place[1]}-${pin}`)) {
          extra.push(`    (net "unconnected-${place[1]}-${pin}"\n      (pins ${place[1]}-${pin})\n    )`);
        }
      }
    }
  }
  return extra.length ? dsn.replace(/\n {4}\(class /, `\n${extra.join("\n")}\n    (class `) : dsn;
}

function boardOutline(circuitJson: AnyCircuitElement[]): { x: number; y: number }[] {
  const board = circuitJson.find((e): e is PcbBoard => e.type === "pcb_board");
  if (!board) throw new Error("circuit JSON has no pcb_board");
  if (board.outline?.length) return board.outline;
  const center = board.center ?? { x: 0, y: 0 };
  const width = board.width ?? 0;
  const height = board.height ?? 0;
  const [hw, hh] = [width / 2, height / 2];
  return [
    { x: center.x - hw, y: center.y - hh },
    { x: center.x + hw, y: center.y - hh },
    { x: center.x + hw, y: center.y + hh },
    { x: center.x - hw, y: center.y + hh },
  ];
}

// dsn-converter emits a bounding-box boundary, no copper-pour planes and no
// board-edge clearance rules. Patch those in from the circuit JSON so freerouting
// sees the real outline, treats poured nets (GND) as planes, and lets edge-connector
// pads sit on the board edge.
function patchDsn(dsn: string, circuitJson: AnyCircuitElement[]): string {
  const outline = boardOutline(circuitJson);
  const um = (v: number) => Math.round(v * 1000);
  const ring = [...outline, outline[0]].map((p) => `${um(p.x)} ${um(p.y)}`).join("  ");

  dsn = dsn.replace(/\(boundary\s*\(path pcb 0[^)]*\)\s*\)/, `(boundary\n      (path pcb 0  ${ring})\n    )`);

  const netNames = new Map<string, string>(
    circuitJson
      .filter((e) => e.type === "source_net")
      .map((n: any) => [n.source_net_id, `${n.name}_${n.source_net_id}`]),
  );
  const planes = circuitJson
    .filter((e: any) => e.type === "pcb_copper_pour" && netNames.has(e.source_net_id))
    .map(
      (e: any) =>
        `    (plane ${netNames.get(e.source_net_id)} (polygon ${e.layer === "top" ? "F.Cu" : "B.Cu"} 0  ${ring}))`,
    )
    .join("\n");
  if (planes) dsn = dsn.replace(/(\(boundary[\s\S]*?\n {4}\)\n)/, `$1${planes}\n`);

  // tscircuit's default 0.15mm clearance leaves the D3 connector finger unroutable
  // (0.54mm gap to its neighbour); 0.2mm, the same as the KiCad flow, routes fully.
  dsn = dsn.replace(/\(clearance (\d+)\)/g, (_, n) => `(clearance ${Math.max(Number(n), MIN_CLEARANCE_UM)})`);

  return dsn.replace(
    /(\(rule\s*\(width \d+\)\s*\(clearance \d+\))/g,
    "$1\n      (clearance 0 (type smd_pcb))\n      (clearance 0 (type pcb))",
  );
}

type DsnPin = { id: string; x: number; y: number };

const parseImages = (dsn: string) =>
  new Map(
    [...dsn.matchAll(/\n {4}\(image ("[^"]*"|\S+)\n([\s\S]*?)\n {4}\)/g)].map((m) => [
      m[1],
      [...m[2].matchAll(/\(pin\s+\S+\s+(?:\(rotate\s+-?\d+\)\s+)?(\S+)\s+-?[\d.]+\s+-?[\d.]+\)/g)].map(
        (p): DsnPin => ({ id: p[1], x: Number(p[2]), y: Number(p[3]) }),
      ),
    ]),
  );

const parseComponents = (dsn: string) =>
  [...dsn.matchAll(/\(component\s+("[^"]*"|\S+)\s*\n((?:\s*\(place[^\n]*\n)+)/g)].map((m) => ({
    image: m[1],
    refs: [...m[2].matchAll(/\(place\s+"?([^\s"]+)"?/g)].map((p) => p[1]),
  }));

// Verify DSN structure and assumptions
function verifyDsn(dsn: string, circuitJson: AnyCircuitElement[]): void {
  const problems: string[] = [];
  const images = parseImages(dsn);
  const components = parseComponents(dsn);

  for (const c of components) {
    if (c.refs.length !== 1) {
      problems.push(`image ${c.image} is shared by ${c.refs.length} parts (${c.refs.join(", ")}); unique-image key no longer works`);
    }
  }
  for (const [name, pins] of images) {
    const seen = new Set<string>();
    for (const p of pins) {
      if (seen.has(p.id)) problems.push(`image ${name} has duplicate pin id ${p.id}`);
      seen.add(p.id);
    }
  }

  const byId = <T extends { [k: string]: any }>(type: string, key: string) =>
    new Map<string, T>(
      circuitJson.filter((e) => e.type === type).map((e: any) => [e[key], e as T]),
    );
  const pcbComponents = byId("pcb_component", "pcb_component_id");
  const pcbPorts = byId("pcb_port", "pcb_port_id");
  const sourcePorts = byId("source_port", "source_port_id");
  const padsPerComponent = new Map<string, number>();

  for (const pad of circuitJson as any[]) {
    if ((pad.type !== "pcb_plated_hole" && pad.type !== "pcb_smtpad") || !pad.pcb_component_id) continue;
    padsPerComponent.set(pad.pcb_component_id, (padsPerComponent.get(pad.pcb_component_id) ?? 0) + 1);
    const comp = pcbComponents.get(pad.pcb_component_id)!;
    const imageName = [...images.keys()].find((k) => k.includes(`~${comp.source_component_id}:`));
    if (!imageName) {
      problems.push(`no image for part ${comp.source_component_id}`);
      continue;
    }
    const hints: string[] =
      sourcePorts.get(pcbPorts.get(pad.pcb_port_id)?.source_port_id)?.port_hints ?? pad.port_hints ?? [];
    const id = hints.find((h) => /^\d+$/.test(h));
    if (!id) {
      problems.push(`pad at (${pad.x}, ${pad.y}) of ${comp.source_component_id} has no numeric pin id`);
      continue;
    }
    const pin = images.get(imageName)!.find((p) => p.id === id);
    if (!pin) {
      problems.push(`${comp.source_component_id}: pad ${id} is missing from its image`);
    } else if (typeof pad.x === "number") {
      const [dx, dy] = [
        (Number(pad.x.toFixed(3)) - comp.center.x) * 1e3,
        (Number(pad.y.toFixed(3)) - comp.center.y) * 1e3,
      ];
      if (Math.abs(pin.x - dx) > 2 || Math.abs(pin.y - dy) > 2) {
        problems.push(
          `${comp.source_component_id}: pad ${id} is at (${pin.x}, ${pin.y}) in the DSN but (${dx}, ${dy}) in the design`,
        );
      }
    }
  }

  for (const [pcbId, count] of padsPerComponent) {
    const comp = pcbComponents.get(pcbId)!;
    const imageName = [...images.keys()].find((k) => k.includes(`~${comp.source_component_id}:`));
    if (imageName && images.get(imageName)!.length !== count) {
      problems.push(
        `${comp.source_component_id}: ${count} pads in the design but ${images.get(imageName)!.length} pins in the DSN image`,
      );
    }
  }

  const allPins = new Set(
    components.flatMap((c) => c.refs.flatMap((ref) => (images.get(c.image) ?? []).map((p) => `${ref}-${p.id}`))),
  );
  const netCount = new Map<string, number>();
  for (const m of dsn.matchAll(/\(net\s+"?[^"\s]+"?\s*\n\s*\(pins([^)]*)\)/g)) {
    for (const pin of m[1].trim().split(/\s+/)) netCount.set(pin, (netCount.get(pin) ?? 0) + 1);
  }
  for (const [pin, n] of netCount) {
    if (!allPins.has(pin)) problems.push(`net references ${pin}, which is not a pin of any part`);
    if (n > 1) problems.push(`pin ${pin} is in ${n} nets`);
  }
  for (const pin of allPins) {
    if (!netCount.has(pin)) problems.push(`pin ${pin} is in no net (it would not be an obstacle)`);
  }

  const outline = boardOutline(circuitJson);
  const boundary = dsn.match(/\(boundary\s*\(path pcb 0\s+([^)]*)\)/)?.[1].trim().split(/\s+/) ?? [];
  if (boundary.length !== (outline.length + 1) * 2) {
    problems.push(`boundary has ${boundary.length / 2} points, expected ${outline.length + 1} (outline patch did not apply)`);
  }
  const nets = new Set(circuitJson.filter((e) => e.type === "source_net").map((n: any) => n.source_net_id));
  const pours = circuitJson.filter((e: any) => e.type === "pcb_copper_pour" && nets.has(e.source_net_id)).length;
  const planes = (dsn.match(/\(plane /g) ?? []).length;
  if (planes !== pours) problems.push(`${planes} planes in the DSN but ${pours} copper pours in the design`);
  for (const m of dsn.matchAll(/\(clearance (\d+)\)/g)) {
    if (Number(m[1]) < MIN_CLEARANCE_UM) problems.push(`clearance ${m[1]}um is below the ${MIN_CLEARANCE_UM}um minimum`);
  }
  const rules = (dsn.match(/\(rule\s*\(width \d+\)/g) ?? []).length;
  for (const kind of ["pcb", "smd_pcb"]) {
    const n = (dsn.match(new RegExp(`\\(clearance 0 \\(type ${kind}\\)\\)`, "g")) ?? []).length;
    if (n !== rules) {
      problems.push(`${n} "(clearance 0 (type ${kind}))" rules for ${rules} rule blocks (edge clearance patch did not apply)`);
    }
  }

  if (problems.length) {
    const shown = problems.slice(0, 12).map((p) => `  - ${p}`).join("\n");
    throw new Error(
      `DSN self-check failed: dsn-converter output no longer matches what dsn-adapter expects (${problems.length} problem(s)):\n${shown}${problems.length > 12 ? "\n  ..." : ""}`,
    );
  }
}

/**
 * Creates and formats a Specctra DSN string from Circuit JSON for Freerouting,
 * applying all required syntax patches, board outline, and obstacle planes.
 */
export function createDsn(circuitJson: AnyCircuitElement[]): string {
  const dsn = patchDsn(
    addUnconnectedPinNets(
      dropDuplicateTraceNets(
        fixUnportedPinIds(
          normalizeScientific(convertCircuitJsonToDsnString(withUniqueImages(circuitJson))),
          circuitJson,
        ),
      ),
    ),
    circuitJson,
  );
  verifyDsn(dsn, circuitJson);
  return dsn;
}

/**
 * Parses Freerouting SES session output and merges routed traces and vias back into
 * the Circuit JSON, repairing through-via layer properties for KiCad compatibility.
 */
export function mergeSesToCircuitJson(
  dsn: string,
  ses: string,
  circuitJson: AnyCircuitElement[],
): AnyCircuitElement[] {
  const session = parseDsnToDsnJson(ses) as DsnSession;
  const dsnPcb = parseDsnToDsnJson(dsn) as DsnPcb;
  const routed = convertDsnSessionToCircuitJson(dsnPcb, session, circuitJson);

  const traces = (routed as AnyCircuitElement[]).filter(
    (e): e is PcbTrace | PcbVia => e.type === "pcb_trace" || e.type === "pcb_via",
  );

  // Every via is a through via; dsn-converter guesses layers from adjacent wires, so a via
  // that ends on the GND plane comes back top->top (invalid in KiCad).
  for (const e of traces) {
    if (e.type === "pcb_via") {
      Object.assign(e, {
        from_layer: "top",
        to_layer: "bottom",
        layers: ["top", "bottom"],
      });
    } else if (e.type === "pcb_trace" && Array.isArray((e as any).route)) {
      for (const p of (e as any).route) {
        if (p.route_type === "via") {
          Object.assign(p, { from_layer: "top", to_layer: "bottom" });
        }
      }
    }
  }

  return [
    ...circuitJson.filter((e) => e.type !== "pcb_trace" && e.type !== "pcb_via"),
    ...traces,
  ];
}
