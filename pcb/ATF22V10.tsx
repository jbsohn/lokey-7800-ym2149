import { type ChipProps } from "tscircuit";

// Pin map matches pld/rom_ym_32pin.pld (GAL22V10: GND=12, VCC=24,
// pins 14-23 are I/O macrocells; pins 14-15 are used as IOA3/IOA4 inputs)
export const ATF22V10 = (props: ChipProps) => (
  <chip
    {...props}
    manufacturerPartNumber="ATF22V10"
    footprint="dip24_w300mil"
    pinLabels={{
      1: "PHI2",
      2: "HALT",
      3: "RW",
      4: "A0",
      5: "A11",
      6: "A12",
      7: "A13",
      8: "A14",
      9: "A15",
      10: "IOA0",
      11: "IOA1",
      12: "GND",
      13: "IOA2",
      14: "IOA3",
      15: "IOA4",
      16: "ROM_A14",
      17: "ROM_A15",
      18: "ROM_A16",
      19: "ROM_A17",
      20: "ROM_A18",
      21: "ROM_CE",
      22: "BC1",
      23: "BDIR",
      24: "VCC",
    }}
    schPinArrangement={{
      topSide: { pins: ["VCC"], direction: "left-to-right" },
      bottomSide: { pins: ["GND"], direction: "left-to-right" },
      leftSide: {
        pins: ["PHI2", "HALT", "RW", "A0", "A11", "A12", "A13", "A14", "A15", "IOA0", "IOA1", "IOA2", "IOA3", "IOA4"],
        direction: "top-to-bottom",
      },
      rightSide: {
        pins: ["ROM_CE", "BDIR", "BC1", "ROM_A14", "ROM_A15", "ROM_A16", "ROM_A17", "ROM_A18"],
        direction: "top-to-bottom",
      },
    }}
  />
);
