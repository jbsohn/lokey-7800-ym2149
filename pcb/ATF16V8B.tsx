import { type ChipProps } from "tscircuit";

// Pin map matches pld/rom_ym_28pin.pld (GAL16V8: GND=10, VCC=20)
export const ATF16V8B = (props: ChipProps) => (
  <chip
    {...props}
    manufacturerPartNumber="ATF16V8B"
    footprint="dip20_w300mil"
    pinLabels={{
      1: "NC",
      2: "HALT",
      3: "RW",
      4: "A0",
      5: "A11",
      6: "A12",
      7: "A13",
      8: "A14",
      9: "A15",
      10: "GND",
      11: "PHI2",
      12: "NC12",
      13: "NC13",
      14: "NC14",
      15: "NC15",
      16: "NC16",
      17: "ROM_CE",
      18: "BC1",
      19: "BDIR",
      20: "VCC",
    }}
    schPinArrangement={{
      topSide: { pins: ["VCC"], direction: "left-to-right" },
      bottomSide: { pins: ["GND"], direction: "left-to-right" },
      leftSide: {
        pins: ["HALT", "RW", "A0", "A11", "A12", "A13", "A14", "A15", "PHI2"],
        direction: "top-to-bottom"
      },
      rightSide: {
        pins: ["BDIR", "BC1", "ROM_CE"],
        direction: "top-to-bottom"
      }
    }}
  />
);
