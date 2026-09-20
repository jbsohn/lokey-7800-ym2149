import { convertCircuitJsonToDsnString } from "dsn-converter";

const MIN_CLEARANCE_UM = 200;

// dsn-converter keys each footprint image on `ftype + width x height` and reuses one
// part's pins for every part in that group, so same-size parts with different pin
// orientations get each other's pins (freerouting then misses their pads). Make the
// key unique per part so every part gets its own, correct image.
function withUniqueImages(circuitJson: any[]): any[] {
  return circuitJson.map((e) =>
    e.type === "source_component" ? { ...e, ftype: `${e.ftype}~${e.source_component_id}` } : e,
  );
}

// Pads with no source port (unused pins, e.g. U_YM 2/5/26/39) get their pin id from a
// counter that starts at 1, so they collide with real pins (duplicate ids) and the real
// pads' nets can land on them. Use the number the pad itself carries in `port_hints`.
function fixUnportedPinIds(dsn: string, circuitJson: any[]): string {
  const components = new Map(circuitJson.filter((e) => e.type === "pcb_component").map((e) => [e.pcb_component_id, e]));
  for (const pad of circuitJson) {
    if ((pad.type !== "pcb_plated_hole" && pad.type !== "pcb_smtpad") || pad.pcb_port_id || !pad.pcb_component_id) continue;
    const id = pad.port_hints?.find((h: string) => /^\d+$/.test(h));
    const comp = components.get(pad.pcb_component_id);
    if (!id || !comp) continue;
    const dx = (Number(pad.x.toFixed(3)) - comp.center.x) * 1e3;
    const dy = (Number(pad.y.toFixed(3)) - comp.center.y) * 1e3;
    const image = new RegExp(`\\n    \\(image "[^"]*~${comp.source_component_id}:[^"]*"\\n(?:.|\\n)*?\\n    \\)`);
    dsn = dsn.replace(image, (block) =>
      block.replace(
        /\(pin(\s+\S+\s+(?:\(rotate\s+-?\d+\)\s+)?)(\S+)\s+(-?[\d.]+)\s+(-?[\d.]+)\)/g,
        (whole, head, _old, x, y) => (Math.abs(Number(x) - dx) < 0.5 && Math.abs(Number(y) - dy) < 0.5 ? `(pin${head}${id} ${x} ${y})` : whole),
      ),
    );
  }
  return dsn;
}

// Every hand-placed <trace from to> becomes its own 2-pin `Net-(...)` net even when
// both pins already belong to a real net, so those pins sit in two nets at once.
// Drop the duplicates (the real nets keep the connectivity).
function dropDuplicateTraceNets(dsn: string): string {
  const netRe = /\n    \(net\s+"?([^"\s]+)"?\s*\n\s*\(pins([^)]*)\)\s*\n\s*\)/g;
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
  for (const m of dsn.matchAll(/\n    \(image ("[^"]*"|\S+)\n((?:.|\n)*?)\n    \)/g)) {
    const pins = [...m[2].matchAll(/\(pin\s+\S+\s+(?:\(rotate\s+-?\d+\)\s+)?(\S+)\s+-?[\d.]+\s+-?[\d.]+\)/g)].map((p) => p[1]);
    imagePins.set(m[1], pins);
  }
  const extra: string[] = [];
  for (const m of dsn.matchAll(/\(component\s+("[^"]*"|\S+)\s*\n((?:\s*\(place[^\n]*\n)+)/g)) {
    for (const place of m[2].matchAll(/\(place\s+"?([^\s"]+)"?/g)) {
      for (const pin of imagePins.get(m[1]) ?? []) {
        if (!used.has(`${place[1]}-${pin}`)) extra.push(`    (net "unconnected-${place[1]}-${pin}"\n      (pins ${place[1]}-${pin})\n    )`);
      }
    }
  }
  return extra.length ? dsn.replace(/\n    \(class /, `\n${extra.join("\n")}\n    (class `) : dsn;
}

// dsn-converter emits a bounding-box boundary, no copper-pour planes and no
// board-edge clearance rules. Patch those in from the circuit JSON so freerouting
// sees the real outline, treats poured nets (GND) as planes, and lets edge-connector
// pads sit on the board edge.
function patchDsn(dsn: string, circuitJson: any[]): string {
  const board = circuitJson.find((e) => e.type === "pcb_board");
  const outline: { x: number; y: number }[] | undefined = board?.outline;
  if (!outline?.length) return dsn;
  const um = (v: number) => Math.round(v * 1000);
  const ring = [...outline, outline[0]].map((p) => `${um(p.x)} ${um(p.y)}`).join("  ");
  dsn = dsn.replace(/\(boundary\s*\(path pcb 0[^)]*\)\s*\)/, `(boundary\n      (path pcb 0  ${ring})\n    )`);

  const netNames = new Map<string, string>(
    circuitJson.filter((e) => e.type === "source_net").map((n) => [n.source_net_id, `${n.name}_${n.source_net_id}`]),
  );
  const planes = circuitJson
    .filter((e) => e.type === "pcb_copper_pour" && netNames.has(e.source_net_id))
    .map((e) => `    (plane ${netNames.get(e.source_net_id)} (polygon ${e.layer === "top" ? "F.Cu" : "B.Cu"} 0  ${ring}))`)
    .join("\n");
  if (planes) dsn = dsn.replace(/(\(boundary[\s\S]*?\n    \)\n)/, `$1${planes}\n`);

  // tscircuit's default 0.15mm clearance leaves the D3 connector finger unroutable
  // (0.54mm gap to its neighbour); 0.2mm, the same as the KiCad flow, routes fully.
  dsn = dsn.replace(/\(clearance (\d+)\)/g, (_, n) => `(clearance ${Math.max(Number(n), MIN_CLEARANCE_UM)})`);

  return dsn.replace(/(\(rule\s*\(width \d+\)\s*\(clearance \d+\))/g, "$1\n      (clearance 0 (type smd_pcb))\n      (clearance 0 (type pcb))");
}

export const buildDsn = (circuitJson: any[]): string =>
  patchDsn(
    addUnconnectedPinNets(dropDuplicateTraceNets(fixUnportedPinIds(convertCircuitJsonToDsnString(withUniqueImages(circuitJson)), circuitJson))),
    circuitJson,
  );
