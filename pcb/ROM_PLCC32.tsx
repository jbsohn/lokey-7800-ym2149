import { type ChipProps } from "tscircuit";

// Standard JEDEC MS-016 32-lead PLCC surface-mount footprint.
// Compatible with SST39SF010A, SST39SF020A, SST39SF040, AT29C010A, AT29C020A, etc.
// Pitch is 1.27mm (50 mil).
const PLCC32_PADS = [
  // Top side (Pins 30-32, 1-4 at y = -6.8375mm)
  { num: 1,  x: 0,       y: -6.8375, w: 0.6,   h: 1.475 },
  { num: 2,  x: -1.27,   y: -6.8375, w: 0.6,   h: 1.475 },
  { num: 3,  x: -2.54,   y: -6.8375, w: 0.6,   h: 1.475 },
  { num: 4,  x: -3.81,   y: -6.8375, w: 0.6,   h: 1.475 },
  { num: 30, x: 3.81,    y: -6.8375, w: 0.6,   h: 1.475 },
  { num: 31, x: 2.54,    y: -6.8375, w: 0.6,   h: 1.475 },
  { num: 32, x: 1.27,    y: -6.8375, w: 0.6,   h: 1.475 },

  // Left side (Pins 5-13 at x = -5.5625mm)
  { num: 5,  x: -5.5625, y: -5.08,   w: 1.475, h: 0.6 },
  { num: 6,  x: -5.5625, y: -3.81,   w: 1.475, h: 0.6 },
  { num: 7,  x: -5.5625, y: -2.54,   w: 1.475, h: 0.6 },
  { num: 8,  x: -5.5625, y: -1.27,   w: 1.475, h: 0.6 },
  { num: 9,  x: -5.5625, y: 0.0,     w: 1.475, h: 0.6 },
  { num: 10, x: -5.5625, y: 1.27,    w: 1.475, h: 0.6 },
  { num: 11, x: -5.5625, y: 2.54,    w: 1.475, h: 0.6 },
  { num: 12, x: -5.5625, y: 3.81,    w: 1.475, h: 0.6 },
  { num: 13, x: -5.5625, y: 5.08,    w: 1.475, h: 0.6 },

  // Bottom side (Pins 14-20 at y = 6.8375mm)
  { num: 14, x: -3.81,   y: 6.8375,  w: 0.6,   h: 1.475 },
  { num: 15, x: -2.54,   y: 6.8375,  w: 0.6,   h: 1.475 },
  { num: 16, x: -1.27,   y: 6.8375,  w: 0.6,   h: 1.475 },
  { num: 17, x: 0,       y: 6.8375,  w: 0.6,   h: 1.475 },
  { num: 18, x: 1.27,    y: 6.8375,  w: 0.6,   h: 1.475 },
  { num: 19, x: 2.54,    y: 6.8375,  w: 0.6,   h: 1.475 },
  { num: 20, x: 3.81,    y: 6.8375,  w: 0.6,   h: 1.475 },

  // Right side (Pins 21-29 at x = 5.5625mm)
  { num: 21, x: 5.5625,  y: 5.08,    w: 1.475, h: 0.6 },
  { num: 22, x: 5.5625,  y: 3.81,    w: 1.475, h: 0.6 },
  { num: 23, x: 5.5625,  y: 2.54,    w: 1.475, h: 0.6 },
  { num: 24, x: 5.5625,  y: 1.27,    w: 1.475, h: 0.6 },
  { num: 25, x: 5.5625,  y: 0.0,     w: 1.475, h: 0.6 },
  { num: 26, x: 5.5625,  y: -1.27,   w: 1.475, h: 0.6 },
  { num: 27, x: 5.5625,  y: -2.54,   w: 1.475, h: 0.6 },
  { num: 28, x: 5.5625,  y: -3.81,   w: 1.475, h: 0.6 },
  { num: 29, x: 5.5625,  y: -5.08,   w: 1.475, h: 0.6 },
];

export const ROM_PLCC32 = (props: ChipProps) => (
  <chip
    {...props}
    manufacturerPartNumber="PLCC-32 SMD Socket (SST39SF010/020/040)"
    pinLabels={{
      1: "VPP",
      2: "A16",
      3: "A15",
      4: "A12",
      5: "A7",
      6: "A6",
      7: "A5",
      8: "A4",
      9: "A3",
      10: "A2",
      11: "A1",
      12: "A0",
      13: "D0",
      14: "D1",
      15: "D2",
      16: "GND",
      17: "D3",
      18: "D4",
      19: "D5",
      20: "D6",
      21: "D7",
      22: "CE",
      23: "A10",
      24: "OE",
      25: "A11",
      26: "A9",
      27: "A8",
      28: "A13",
      29: "A14",
      30: "A17",
      31: "A18",
      32: "VCC",
    }}
    schPinArrangement={{
      topSide: { pins: ["VCC", "VPP"], direction: "left-to-right" },
      bottomSide: { pins: ["GND"], direction: "left-to-right" },
      leftSide: {
        pins: [
          "CE", "OE", "A18", "A17", "A16", "A15", "A14", "A13",
          "A12", "A11", "A10", "A9", "A8", "A7", "A6", "A5",
          "A4", "A3", "A2", "A1", "A0",
        ],
        direction: "top-to-bottom",
      },
      rightSide: {
        pins: ["D7", "D6", "D5", "D4", "D3", "D2", "D1", "D0"],
        direction: "top-to-bottom",
      },
    }}
  >
    <footprint>
      {PLCC32_PADS.map((pad) => (
        <smtpad
          key={pad.num}
          shape="rect"
          pcbX={pad.x}
          pcbY={pad.y}
          width={pad.w}
          height={pad.h}
          layer="top"
          portHints={[`pin${pad.num}`, `${pad.num}`]}
        />
      ))}
      {/* Silkscreen Pin 1 index notch / chamfer and label */}
      <silkscreentext
        pcbX={0}
        pcbY={-4.5}
        text="PLCC-32"
        fontSize="0.8mm"
      />
      <silkscreentext
        pcbX={0}
        pcbY={-5.5}
        text="▲ 1"
        fontSize="0.7mm"
      />
    </footprint>
  </chip>
);
