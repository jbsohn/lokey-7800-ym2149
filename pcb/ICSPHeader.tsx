import { type ChipProps } from "tscircuit";

/**
 * Standard 2x3 ICSP Header (AVR 6-pin ICSP).
 * Pitch: 2.54mm (0.100").
 * Size: 5.08mm x 7.62mm.
 *
 * Pinout:
 *   1: MISO    2: VCC
 *   3: SCK     4: MOSI
 *   5: RESET   6: GND
 */
export const ICSPHeader = (props: ChipProps) => (
  <chip
    {...props}
    manufacturerPartNumber="ICSP-2X3-2.54MM"
    pinLabels={{
      1: "MISO",
      2: "VCC",
      3: "SCK",
      4: "MOSI",
      5: "RESET",
      6: "GND",
    }}
    schPinArrangement={{
      leftSide: { pins: ["MISO", "SCK", "RESET"], direction: "top-to-bottom" },
      rightSide: { pins: ["VCC", "MOSI", "GND"], direction: "top-to-bottom" },
    }}
  >
    <footprint>
      {/* Column 1 (Odd pins: MISO, SCK, RESET at x = -1.27mm) */}
      <platedhole
        shape="circle"
        holeDiameter="0.85mm"
        outerDiameter="1.55mm"
        pcbX="-1.27mm"
        pcbY="2.54mm"
        portHints={["pin1"]}
      />
      <platedhole
        shape="circle"
        holeDiameter="0.85mm"
        outerDiameter="1.55mm"
        pcbX="-1.27mm"
        pcbY="0mm"
        portHints={["pin3"]}
      />
      <platedhole
        shape="circle"
        holeDiameter="0.85mm"
        outerDiameter="1.55mm"
        pcbX="-1.27mm"
        pcbY="-2.54mm"
        portHints={["pin5"]}
      />

      {/* Column 2 (Even pins: VCC, MOSI, GND at x = 1.27mm) */}
      <platedhole
        shape="circle"
        holeDiameter="0.85mm"
        outerDiameter="1.55mm"
        pcbX="1.27mm"
        pcbY="2.54mm"
        portHints={["pin2"]}
      />
      <platedhole
        shape="circle"
        holeDiameter="0.85mm"
        outerDiameter="1.55mm"
        pcbX="1.27mm"
        pcbY="0mm"
        portHints={["pin4"]}
      />
      <platedhole
        shape="circle"
        holeDiameter="0.85mm"
        outerDiameter="1.55mm"
        pcbX="1.27mm"
        pcbY="-2.54mm"
        portHints={["pin6"]}
      />
    </footprint>
  </chip>
);
