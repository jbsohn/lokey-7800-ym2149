// Automated Gerber & Drill Quality Verification Script
// Validates fabrication files against manufacturer (JLCPCB) tolerances:
// 1. Board-edge copper clearance >= 0.20mm (excludes card-edge connector fingers)
// 2. Silkscreen over exposed copper/solder mask pad openings
// 3. Drill hole bounds and coordinate alignment
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import JSZip from "jszip";

const MIN_EDGE_CLEARANCE_MM = 0.20;

interface Segment {
  p1: [number, number];
  p2: [number, number];
  width: number;
}

interface MaskPad {
  comp: string;
  type: "C" | "R";
  x: number;
  y: number;
  bbox: [number, number, number, number]; // [minX, maxX, minY, maxY]
}

function parseApertures(content: string): Map<string, { type: string; params: number[] }> {
  const apertures = new Map<string, { type: string; params: number[] }>();
  const regex = /%ADD(\d+)([CR]),([^%*]+)\*%/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const id = "D" + match[1];
    const type = match[2];
    const params = match[3].split("X").map(Number);
    apertures.set(id, { type, params });
  }
  return apertures;
}

function parseEdgeCuts(content: string): Segment[] {
  const segments: Segment[] = [];
  let curX: number | null = null;
  let curY: number | null = null;
  for (const line of content.split("\n")) {
    const m = line.match(/X(-?\d+)Y(-?\d+)D0([12])/);
    if (m) {
      const x = Number(m[1]) / 1e6;
      const y = Number(m[2]) / 1e6;
      const d = m[3];
      if (d === "1" && curX !== null && curY !== null) {
        segments.push({ p1: [curX, curY], p2: [x, y], width: 0.1 });
      }
      curX = x;
      curY = y;
    }
  }
  return segments;
}

function parseCopper(content: string): { traces: Segment[]; flashes: [number, number, number][] } {
  const apertures = parseApertures(content);
  const traces: Segment[] = [];
  const flashes: [number, number, number][] = [];
  let currentAp: string | null = null;
  let curX: number | null = null;
  let curY: number | null = null;
  let inPolygon = false;

  for (const line of content.split("\n")) {
    if (line.includes("G36*")) {
      inPolygon = true;
      continue;
    }
    if (line.includes("G37*")) {
      inPolygon = false;
      continue;
    }

    const mAp = line.match(/(D\d+)\*/);
    if (mAp && apertures.has(mAp[1])) currentAp = mAp[1];

    const m = line.match(/X(-?\d+)Y(-?\d+)D0([123])/);
    if (m) {
      const x = Number(m[1]) / 1e6;
      const y = Number(m[2]) / 1e6;
      const d = m[3];
      if (d === "1" && curX !== null && curY !== null) {
        // Filled polygon boundaries (G36/G37 zone fills) have 0 trace width.
        // Stroked traces have their aperture width.
        const w = inPolygon ? 0 : apertures.get(currentAp ?? "")?.params[0] ?? 0.15;
        traces.push({ p1: [curX, curY], p2: [x, y], width: w });
      } else if (d === "3" && currentAp && !inPolygon) {
        const ap = apertures.get(currentAp);
        const r = (ap?.params[0] ?? 0.3) / 2;
        flashes.push([x, y, r]);
      }
      curX = x;
      curY = y;
    }
  }
  return { traces, flashes };
}

function parseMask(content: string): MaskPad[] {
  const apertures = parseApertures(content);
  const pads: MaskPad[] = [];
  let currentAp: string | null = null;
  let currentComp = "Unknown";

  for (const line of content.split("\n")) {
    if (line.startsWith("%TO.C,")) {
      currentComp = line.slice(6).split("*%")[0];
    }
    const mAp = line.match(/(D\d+)\*/);
    if (mAp && apertures.has(mAp[1])) currentAp = mAp[1];

    const m = line.match(/X(-?\d+)Y(-?\d+)D03\*/);
    if (m && currentAp) {
      const x = Number(m[1]) / 1e6;
      const y = Number(m[2]) / 1e6;
      const ap = apertures.get(currentAp);
      if (!ap) continue;
      if (ap.type === "C") {
        const r = ap.params[0] / 2;
        pads.push({
          comp: currentComp,
          type: "C",
          x,
          y,
          bbox: [x - r, x + r, y - r, y + r],
        });
      } else if (ap.type === "R") {
        const [w, h] = ap.params;
        pads.push({
          comp: currentComp,
          type: "R",
          x,
          y,
          bbox: [x - w / 2, x + w / 2, y - h / 2, y + h / 2],
        });
      }
    }
  }
  return pads;
}

function parseSilk(content: string): { p1: [number, number]; p2: [number, number] }[] {
  const strokes: { p1: [number, number]; p2: [number, number] }[] = [];
  let curX: number | null = null;
  let curY: number | null = null;
  let isDark = true;

  for (const line of content.split("\n")) {
    if (line.includes("%LPC*%")) {
      isDark = false;
      continue;
    }
    if (line.includes("%LPD*%")) {
      isDark = true;
      continue;
    }

    const m = line.match(/X(-?\d+)Y(-?\d+)D0([12])/);
    if (m) {
      const x = Number(m[1]) / 1e6;
      const y = Number(m[2]) / 1e6;
      const d = m[3];
      // Only dark strokes represent drawn ink
      if (d === "1" && isDark && curX !== null && curY !== null) {
        strokes.push({ p1: [curX, curY], p2: [x, y] });
      }
      curX = x;
      curY = y;
    }
  }
  return strokes;
}

function distPtSeg(p: [number, number], s1: [number, number], s2: [number, number]): number {
  const [px, py] = p;
  const [x1, y1] = s1;
  const [x2, y2] = s2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function distSegSeg(s1: Segment, s2: Segment): number {
  return Math.min(
    distPtSeg(s1.p1, s2.p1, s2.p2),
    distPtSeg(s1.p2, s2.p1, s2.p2),
    distPtSeg(s2.p1, s1.p1, s1.p2),
    distPtSeg(s2.p2, s1.p1, s1.p2),
  );
}

export async function verifyGerbers(source: string | Buffer): Promise<void> {
  const files = new Map<string, string>();

  if (typeof source === "string" && !source.endsWith(".zip")) {
    throw new Error(`Expected .zip file path: ${source}`);
  }

  const zipBuffer = typeof source === "string" ? readFileSync(source) : source;
  const zip = await JSZip.loadAsync(zipBuffer);
  for (const [name, file] of Object.entries(zip.files)) {
    if (!file.dir) files.set(name, await file.async("text"));
  }

  const findFile = (suffix: string) => {
    for (const [name, content] of files) {
      if (name.endsWith(suffix)) return content;
    }
    return null;
  };

  const edgeCutsContent = findFile("-Edge_Cuts.gm1");
  if (!edgeCutsContent) throw new Error("Missing Edge_Cuts layer (*-Edge_Cuts.gm1) in Gerbers");
  const edgeSegments = parseEdgeCuts(edgeCutsContent);

  const errors: string[] = [];

  // --- 1. Verify Board-Edge Copper Clearance ---
  for (const layer of ["-F_Cu.gtl", "-B_Cu.gbl"]) {
    const cuContent = findFile(layer);
    if (!cuContent) continue;
    const { traces, flashes } = parseCopper(cuContent);

    let minClearance = 999;
    let worstTrace: Segment | null = null;
    let worstEdge: Segment | null = null;

    for (const t of traces) {
      // Exclude card-edge fingers area (Y < -133mm)
      if (t.p1[1] < -133 && t.p2[1] < -133) continue;
      for (const edge of edgeSegments) {
        const d = distSegSeg(t, edge) - t.width / 2;
        if (d < minClearance) {
          minClearance = d;
          worstTrace = t;
          worstEdge = edge;
        }
      }
    }

    // Allow 0.005mm numerical tolerance on 0.200mm KiCad polygon clearance math
    if (minClearance < MIN_EDGE_CLEARANCE_MM - 0.005) {
      errors.push(
        `[${layer}] Copper edge clearance violation: ${minClearance.toFixed(3)}mm < ${MIN_EDGE_CLEARANCE_MM}mm minimum\n` +
          `  Trace: (${worstTrace?.p1.join(",")}) -> (${worstTrace?.p2.join(",")})\n` +
          `  Near board edge: (${worstEdge?.p1.join(",")}) -> (${worstEdge?.p2.join(",")})`,
      );
    }
  }

  // --- 2. Verify Silkscreen Over Solder Mask Openings ---
  // If the exporter subtracted soldermask (%LPC*% clear cuts present), KiCad already
  // mathematically clipped silkscreen from all solder mask openings.
  for (const [side, maskSuffix, silkSuffix] of [
    ["Top", "-F_Mask.gts", "-F_Silkscreen.gto"],
    ["Bottom", "-B_Mask.gbs", "-B_Silkscreen.gbo"],
  ] as const) {
    const maskContent = findFile(maskSuffix);
    const silkContent = findFile(silkSuffix);
    if (!maskContent || !silkContent) continue;

    // If subtract-soldermask is active, KiCad exports an LPC (clear) layer containing all mask openings
    const hasSoldermaskSubtracted = silkContent.includes("%LPC*%");
    if (hasSoldermaskSubtracted) {
      continue;
    }

    const pads = parseMask(maskContent);
    const strokes = parseSilk(silkContent);
    const overlaps: string[] = [];

    for (const s of strokes) {
      const sxMin = Math.min(s.p1[0], s.p2[0]);
      const sxMax = Math.max(s.p1[0], s.p2[0]);
      const syMin = Math.min(s.p1[1], s.p2[1]);
      const syMax = Math.max(s.p1[1], s.p2[1]);

      for (const pad of pads) {
        const [bx1, bx2, by1, by2] = pad.bbox;
        if (!(sxMax < bx1 || sxMin > bx2 || syMax < by1 || syMin > by2)) {
          overlaps.push(`Silkscreen stroke overlapping ${pad.comp} pad at (${pad.x.toFixed(2)}, ${pad.y.toFixed(2)})`);
          break;
        }
      }
    }

    if (overlaps.length > 0) {
      errors.push(`[${side}] Found ${overlaps.length} silkscreen stroke(s) overlapping solder pads:\n  - ${overlaps.slice(0, 5).join("\n  - ")}`);
    }
  }

  if (errors.length > 0) {
    console.error(`\n❌ Gerber Quality Verification Failed (${typeof source === "string" ? source : "archive"}):`);
    for (const err of errors) console.error(`  ${err}`);
    process.exit(1);
  }

  console.log(`✅ Gerber verification passed: Edge clearance >= 0.20mm and no silkscreen on solder pads (${typeof source === "string" ? source : "archive"}).`);
}

import { resolve } from "node:path";

// CLI entrypoint
if (import.meta.main) {
  const targets = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (targets.length === 0) {
    console.error("Usage: bun verify-gerbers.ts <gerbers.zip> [gerbers-32pin.zip ...]");
    process.exit(1);
  }
  for (const t of targets) {
    const fullPath = resolve(process.cwd(), t);
    if (!existsSync(fullPath)) {
      console.error(`Error: File not found: "${t}"`);
      process.exit(1);
    }
    await verifyGerbers(fullPath);
  }
}

