import { ATmega324 } from "./ATmega324";
import { DIP40Header } from "./DIP40Header";
import { Crystal3225 } from "./Crystal3225";
import { ICSPHeader } from "./ICSPHeader";

/**
 * 40-Pin DIP Carrier Board / Daughterboard Module for AY-3-8910 / YM2149 PSG.
 *
 * Plugs directly into the U_YM socket on Atari 7800 cartridge boards:
 *  - 100% 5V native ATmega324 (no level shifters)
 *  - Full 8-bit bus DA0–DA7 on MCU PORTA (single-cycle read)
 *  - Full 8-bit IOA0–IOA7 port on MCU PORTC (supports 32-pin bank-switching)
 *  - 27 MHz crystal oscillator + 3-channel analog RC low-pass reconstruction filters
 *  - Standard 6-pin ICSP programming header
 *
 * Based on the AVR-AY project by Yevgeniy Olexandrenko (https://www.avray.ru/,
 * https://github.com/Yevgeniy-Olexandrenko/avr-ay-board).
 */
export default () => (
  <board
    width="19.5mm"
    height="53.5mm"
    routingDisabled={true}
  >
    {/* Global Power and Ground Nets */}
    <net name="VCC" />
    <net name="GND" />
    <net name="LED_NODE" />

    {/* Bus and Control Nets */}
    <net name="RESET" />
    <net name="BDIR" />
    <net name="BC1" />
    <net name="CLOCK" />

    {/* Data Bus Nets */}
    <net name="DA0" />
    <net name="DA1" />
    <net name="DA2" />
    <net name="DA3" />
    <net name="DA4" />
    <net name="DA5" />
    <net name="DA6" />
    <net name="DA7" />

    {/* IOA Bank-Switching Nets */}
    <net name="IOA0" />
    <net name="IOA1" />
    <net name="IOA2" />
    <net name="IOA3" />
    <net name="IOA4" />
    <net name="IOA5" />
    <net name="IOA6" />
    <net name="IOA7" />

    {/* Audio PWM & Analog Filter Nets */}
    <net name="PWM_A" />
    <net name="PWM_B" />
    <net name="PWM_C" />
    <net name="ANALOG_A" />
    <net name="ANALOG_B" />
    <net name="ANALOG_C" />

    {/* Crystal Oscillator Nets */}
    <net name="XTAL1" />
    <net name="XTAL2" />

    {/* SPI / ICSP Nets */}
    <net name="MOSI" />
    <net name="MISO" />
    <net name="SCK" />

    {/* Copper pours on top and bottom */}
    <copperpour layer="bottom" connectsTo="net.GND" boardEdgeMargin="0.25mm" />
    <copperpour layer="top" connectsTo="net.GND" boardEdgeMargin="0.25mm" />

    {/* ==================================================================== */}
    {/* DIP-40 Plug Header (Plated holes for male header pins)               */}
    {/* ==================================================================== */}
    <DIP40Header
      name="U_DIP"
      pcbX="0mm"
      pcbY="0mm"
      schX={-15}
      schY={0}
      connections={{
        GND: "net.GND",
        VCC: "net.VCC",
        RESET: "net.RESET",
        CLOCK: "net.CLOCK",
        BDIR: "net.BDIR",
        BC1: "net.BC1",
        DA0: "net.DA0",
        DA1: "net.DA1",
        DA2: "net.DA2",
        DA3: "net.DA3",
        DA4: "net.DA4",
        DA5: "net.DA5",
        DA6: "net.DA6",
        DA7: "net.DA7",
        IOA0: "net.IOA0",
        IOA1: "net.IOA1",
        IOA2: "net.IOA2",
        IOA3: "net.IOA3",
        IOA4: "net.IOA4",
        IOA5: "net.IOA5",
        IOA6: "net.IOA6",
        IOA7: "net.IOA7",
        ANALOG_A: "net.ANALOG_A",
        ANALOG_B: "net.ANALOG_B",
        ANALOG_C: "net.ANALOG_C",
      }}
    />

    {/* ==================================================================== */}
    {/* Microcontroller: ATmega324 (TQFP-44)                                  */}
    {/* ==================================================================== */}
    <ATmega324
      name="U_MCU"
      pcbX="0mm"
      pcbY="0mm"
      schX={15}
      schY={0}
      connections={{
        VCC: "net.VCC",
        AVCC: "net.VCC",
        GND: "net.GND",
        GND_2: "net.GND",
        RESET: "net.RESET",
        PD2_INT0: "net.BC1",
        PD3_INT1: "net.BDIR",
        PB0_CLK: "net.CLOCK",
        XTAL1: "net.XTAL1",
        XTAL2: "net.XTAL2",
        PA0_DA0: "net.DA0",
        PA1_DA1: "net.DA1",
        PA2_DA2: "net.DA2",
        PA3_DA3: "net.DA3",
        PA4_DA4: "net.DA4",
        PA5_DA5: "net.DA5",
        PA6_DA6: "net.DA6",
        PA7_DA7: "net.DA7",
        PC0_IOA0: "net.IOA0",
        PC1_IOA1: "net.IOA1",
        PC2_IOA2: "net.IOA2",
        PC3_IOA3: "net.IOA3",
        PC4_IOA4: "net.IOA4",
        PC5_IOA5: "net.IOA5",
        PC6_IOA6: "net.IOA6",
        PC7_IOA7: "net.IOA7",
        PD5_OC1A: "net.PWM_A",
        PD7_OC2A: "net.PWM_B",
        PD4_OC1B: "net.PWM_C",
        PB5_MOSI: "net.MOSI",
        PB6_MISO: "net.MISO",
        PB7_SCK: "net.SCK",
      }}
    />

    {/* ==================================================================== */}
    {/* Power Decoupling Capacitors                                           */}
    {/* ==================================================================== */}
    <capacitor
      name="C2"
      capacitance="100nF"
      footprint="0603"
      pcbX="-3mm"
      pcbY="8.5mm"
      schX={10}
      schY={15}
      connections={{ pin1: "net.VCC", pin2: "net.GND" }}
    />
    <capacitor
      name="C4"
      capacitance="100nF"
      footprint="0603"
      pcbX="3mm"
      pcbY="8.5mm"
      schX={12}
      schY={15}
      connections={{ pin1: "net.VCC", pin2: "net.GND" }}
    />

    {/* ==================================================================== */}
    {/* 27 MHz Crystal Oscillator & Load Capacitors                           */}
    {/* ==================================================================== */}
    <Crystal3225
      name="X1"
      pcbX="0mm"
      pcbY="14mm"
      schX={0}
      schY={15}
      connections={{
        XTAL1: "net.XTAL1",
        XTAL2: "net.XTAL2",
        GND: "net.GND",
        GND_2: "net.GND",
      }}
    />
    <capacitor
      name="C1"
      capacitance="18pF"
      footprint="0603"
      pcbX="-3.5mm"
      pcbY="14mm"
      schX={-3}
      schY={15}
      connections={{ pin1: "net.XTAL1", pin2: "net.GND" }}
    />
    <capacitor
      name="C3"
      capacitance="18pF"
      footprint="0603"
      pcbX="3.5mm"
      pcbY="14mm"
      schX={3}
      schY={15}
      connections={{ pin1: "net.XTAL2", pin2: "net.GND" }}
    />

    {/* ==================================================================== */}
    {/* Power LED Indicator                                                  */}
    {/* ==================================================================== */}
    <resistor
      name="R4"
      resistance="1.4k"
      footprint="0603"
      pcbX="-2mm"
      pcbY="20mm"
      schX={-10}
      schY={15}
      connections={{ pin1: "net.VCC", pin2: "net.LED_NODE" }}
    />
    <chip
      name="LED1"
      footprint="0603"
      supplierPartNumbers={{ jlcpcb: ["C72043"] }}
      pcbX="2mm"
      pcbY="20mm"
      schX={-8}
      schY={15}
      pinLabels={{ 1: "anode", 2: "cathode" }}
      connections={{ anode: "net.LED_NODE", cathode: "net.GND" }}
    />

    {/* ==================================================================== */}
    {/* 3-Channel Audio RC Low-Pass Filters (R=3.6k, C=2.2nF)                 */}
    {/* ==================================================================== */}
    {/* Channel A */}
    <resistor
      name="R1"
      resistance="3.6k"
      footprint="0603"
      pcbX="-2.5mm"
      pcbY="-8.5mm"
      schX={25}
      schY={-5}
      connections={{ pin1: "net.PWM_A", pin2: "net.ANALOG_A" }}
    />
    <capacitor
      name="C5"
      capacitance="2.2nF"
      footprint="0603"
      pcbX="2.5mm"
      pcbY="-8.5mm"
      schX={27}
      schY={-5}
      connections={{ pin1: "net.ANALOG_A", pin2: "net.GND" }}
    />

    {/* Channel B */}
    <resistor
      name="R2"
      resistance="3.6k"
      footprint="0603"
      pcbX="-2.5mm"
      pcbY="-11.5mm"
      schX={25}
      schY={0}
      connections={{ pin1: "net.PWM_B", pin2: "net.ANALOG_B" }}
    />
    <capacitor
      name="C6"
      capacitance="2.2nF"
      footprint="0603"
      pcbX="2.5mm"
      pcbY="-11.5mm"
      schX={27}
      schY={0}
      connections={{ pin1: "net.ANALOG_B", pin2: "net.GND" }}
    />

    {/* Channel C */}
    <resistor
      name="R3"
      resistance="3.6k"
      footprint="0603"
      pcbX="-2.5mm"
      pcbY="-14.5mm"
      schX={25}
      schY={5}
      connections={{ pin1: "net.PWM_C", pin2: "net.ANALOG_C" }}
    />
    <capacitor
      name="C7"
      capacitance="2.2nF"
      footprint="0603"
      pcbX="2.5mm"
      pcbY="-14.5mm"
      schX={27}
      schY={5}
      connections={{ pin1: "net.ANALOG_C", pin2: "net.GND" }}
    />

    {/* ==================================================================== */}
    {/* ICSP Programming Header (Standard 2x3 0.1" pitch)                    */}
    {/* ==================================================================== */}
    <ICSPHeader
      name="J_ICSP"
      pcbX="0mm"
      pcbY="-20.5mm"
      schX={35}
      schY={0}
      connections={{
        MISO: "net.MISO",
        VCC: "net.VCC",
        SCK: "net.SCK",
        MOSI: "net.MOSI",
        RESET: "net.RESET",
        GND: "net.GND",
      }}
    />
  </board>
);
