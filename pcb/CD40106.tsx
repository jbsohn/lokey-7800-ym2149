import { type ChipProps } from "tscircuit";

export const CD40106 = (props: ChipProps) => (
  <chip
    footprint="dip14_w300mil"
    {...props}
    manufacturerPartNumber="CD40106BE"
    pinLabels={{
      1: "1A",
      2: "1Y",
      3: "2A",
      4: "2Y",
      5: "3A",
      6: "3Y",
      7: "GND",
      8: "4Y",
      9: "4A",
      10: "5Y",
      11: "5A",
      12: "6Y",
      13: "6A",
      14: "VCC",
    }}
    schPinArrangement={{
      topSide: { pins: ["VCC"], direction: "left-to-right" },
      bottomSide: { pins: ["GND"], direction: "left-to-right" },
      leftSide: { pins: ["1A", "2A", "3A", "4A", "5A", "6A"], direction: "top-to-bottom" },
      rightSide: { pins: ["1Y", "2Y", "3Y", "4Y", "5Y", "6Y"], direction: "top-to-bottom" },
    }}
  />
);
