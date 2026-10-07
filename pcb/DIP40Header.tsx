import { type ChipProps } from "tscircuit";

// 40-pin DIP header pins layout (0.600" row spacing = 15.24mm, 0.100" pin pitch = 2.54mm)
// Plated through-holes accept standard round machined male header pins or square headers.
const DIP40_PINS: Array<{ num: number; x: number; y: number }> = [];

// Left side: Pins 1 to 20 (top to bottom)
for (let i = 1; i <= 20; i++) {
  DIP40_PINS.push({
    num: i,
    x: -7.62,
    y: Number((24.13 - (i - 1) * 2.54).toFixed(3)),
  });
}

// Right side: Pins 21 to 40 (bottom to top)
for (let i = 21; i <= 40; i++) {
  DIP40_PINS.push({
    num: i,
    x: 7.62,
    y: Number((-24.13 + (i - 21) * 2.54).toFixed(3)),
  });
}

/**
 * DIP40Header
 *
 * Provides the 40 male header pins that plug directly into the U_YM socket on the cartridge board.
 * Implemented using plated through-holes to preserve the central 13.7mm routing corridor for the MCU.
 */
export const DIP40Header = (props: ChipProps) => (
  <chip
    {...props}
    manufacturerPartNumber="DIP40-MALE-PLUG"
    pinLabels={{
      1: "GND",
      2: "NC_2",
      3: "ANALOG_B",
      4: "ANALOG_A",
      5: "NC_5",
      6: "IOB7",
      7: "IOB6",
      8: "IOB5",
      9: "IOB4",
      10: "IOB3",
      11: "IOB2",
      12: "IOB1",
      13: "IOB0",
      14: "IOA7",
      15: "IOA6",
      16: "IOA5",
      17: "IOA4",
      18: "IOA3",
      19: "IOA2",
      20: "IOA1",
      21: "IOA0",
      22: "CLOCK",
      23: "RESET",
      24: "A9",
      25: "A8",
      26: "NC_26",
      27: "BDIR",
      28: "BC2",
      29: "BC1",
      30: "DA7",
      31: "DA6",
      32: "DA5",
      33: "DA4",
      34: "DA3",
      35: "DA2",
      36: "DA1",
      37: "DA0",
      38: "ANALOG_C",
      39: "TEST_1",
      40: "VCC",
    }}
    schPinArrangement={{
      topSide: { pins: ["VCC"], direction: "left-to-right" },
      bottomSide: { pins: ["GND"], direction: "left-to-right" },
      leftSide: {
        pins: [
          "RESET",
          "CLOCK",
          "BDIR",
          "BC1",
          "BC2",
          "A8",
          "A9",
          "DA0",
          "DA1",
          "DA2",
          "DA3",
          "DA4",
          "DA5",
          "DA6",
          "DA7",
          "IOA0",
          "IOA1",
          "IOA2",
          "IOA3",
          "IOA4",
          "IOA5",
          "IOA6",
          "IOA7",
        ],
        direction: "top-to-bottom",
      },
      rightSide: {
        pins: [
          "ANALOG_A",
          "ANALOG_B",
          "ANALOG_C",
          "IOB0",
          "IOB1",
          "IOB2",
          "IOB3",
          "IOB4",
          "IOB5",
          "IOB6",
          "IOB7",
        ],
        direction: "top-to-bottom",
      },
    }}
  >
    <footprint>
      {DIP40_PINS.map((p) => (
        <platedhole
          shape="circle"
          holeDiameter="0.85mm"
          outerDiameter="1.55mm"
          pcbX={`${p.x}mm`}
          pcbY={`${p.y}mm`}
          portHints={[`pin${p.num}`]}
        />
      ))}
    </footprint>
  </chip>
);
