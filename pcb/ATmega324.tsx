import { type ChipProps } from "tscircuit";

/**
 * ATmega324PA / ATmega324PB 8-bit Microcontroller in TQFP-44 package.
 * Pin mapping follows standard Microchip / Atmel TQFP-44 pinout:
 *   PORTA (Pins 37..30): DA0..DA7 (PSG Data Bus)
 *   PORTC (Pins 19..26): IOA0..IOA7 (PSG General-Purpose Port A / Bank Switching)
 *   PD2 (Pin 11): INT0 / BC1 bus control
 *   PD3 (Pin 12): INT1 / BDIR bus control
 *   PD5 (Pin 14): OC1A / Audio PWM Channel A
 *   PD7 (Pin 16): OC2A / Audio PWM Channel B
 *   PD4 (Pin 13): OC1B / Audio PWM Channel C
 *   PB5..PB7 (Pins 1..3): SPI / ICSP (MOSI, MISO, SCK)
 *   Pin 4: ~RESET
 *   Pins 7, 8: XTAL2, XTAL1 (27 MHz Crystal)
 *   Pins 5, 27: VCC, AVCC (+5V)
 *   Pins 6, 28: GND
 */
export const ATmega324 = (props: ChipProps) => (
  <chip
    {...props}
    manufacturerPartNumber="ATMEGA324PB-AU"
    supplierPartNumbers={{ jlcpcb: ["C47751"] }}
    footprint="tqfp44"
    pinLabels={{
      1: "PB5_MOSI",
      2: "PB6_MISO",
      3: "PB7_SCK",
      4: "RESET",
      5: "VCC",
      6: "GND",
      7: "XTAL2",
      8: "XTAL1",
      9: "PD0_RXD",
      10: "PD1_TXD",
      11: "PD2_INT0",
      12: "PD3_INT1",
      13: "PD4_OC1B",
      14: "PD5_OC1A",
      15: "PD6_OC2B",
      16: "PD7_OC2A",
      17: "PE2",
      18: "PE3",
      19: "PC0_IOA0",
      20: "PC1_IOA1",
      21: "PC2_IOA2",
      22: "PC3_IOA3",
      23: "PC4_IOA4",
      24: "PC5_IOA5",
      25: "PC6_IOA6",
      26: "PC7_IOA7",
      27: "AVCC",
      28: "GND_2",
      29: "AREF",
      30: "PA7_DA7",
      31: "PA6_DA6",
      32: "PA5_DA5",
      33: "PA4_DA4",
      34: "PA3_DA3",
      35: "PA2_DA2",
      36: "PA1_DA1",
      37: "PA0_DA0",
      38: "PE5",
      39: "PE6",
      40: "PB0_CLK",
      41: "PB1",
      42: "PB2",
      43: "PB3",
      44: "PB4",
    }}
    schPinArrangement={{
      topSide: { pins: ["VCC", "AVCC", "AREF"], direction: "left-to-right" },
      bottomSide: { pins: ["GND", "GND_2"], direction: "left-to-right" },
      leftSide: {
        pins: [
          "RESET",
          "PD2_INT0",
          "PD3_INT1",
          "PB0_CLK",
          "XTAL1",
          "XTAL2",
          "PA0_DA0",
          "PA1_DA1",
          "PA2_DA2",
          "PA3_DA3",
          "PA4_DA4",
          "PA5_DA5",
          "PA6_DA6",
          "PA7_DA7",
        ],
        direction: "top-to-bottom",
      },
      rightSide: {
        pins: [
          "PD5_OC1A",
          "PD7_OC2A",
          "PD4_OC1B",
          "PC0_IOA0",
          "PC1_IOA1",
          "PC2_IOA2",
          "PC3_IOA3",
          "PC4_IOA4",
          "PC5_IOA5",
          "PC6_IOA6",
          "PC7_IOA7",
          "PB5_MOSI",
          "PB6_MISO",
          "PB7_SCK",
          "PD0_RXD",
          "PD1_TXD",
        ],
        direction: "top-to-bottom",
      },
    }}
  />
);
