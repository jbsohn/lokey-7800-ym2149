import { LM358 } from "./LM358";
import { PolarizedCap } from "./PolarizedCap";
import { CD40106 } from "./CD40106";

export interface YmResetAmpProps {
  pcbX?: string;
  pcbY?: string;
}

/**
 * YmResetAmp
 *
 * Encapsulates all components situated physically underneath the YM2149 DIP-40 socket
 * on the bottom layer (`layer="bottom"`, `pcbY="0mm"` relative to group YM):
 *
 * 1. CD40106 Active Schmitt-Trigger Reset Delay Buffer (U_RESET, R_RESET 220k, C_RESET 10uF)
 *    Holds YM Pin 23 (!RESET) low for ~2.0s during 7800 BIOS boot to prevent bus writes.
 * 2. LM358 Active Shunt Op-Amp Audio Stage (U_AMP, C_AMP 0.1uF, R_FB 1k, C_AUDIO_OUT 10uF)
 *
 * Preserves the central routing corridor between X = +1.31mm and X = +4.88mm for bus traces.
 */
export const YmResetAmp = ({ pcbX = "0mm", pcbY = "0mm" }: YmResetAmpProps) => (
  <group name="YmResetAmp" pcbX={pcbX} pcbY={pcbY}>
    {/* Local power link between LM358 (Pin 8) and CD40106 (Pin 14) */}
    <trace from=".U_AMP > .VCC" to=".U_RESET > .VCC" thickness="0.4mm" />

    {/* CD40106 Schmitt-Trigger Inverter */}
    <CD40106
      name="U_RESET"
      footprint="dip14_w300mil"
      schX={14}
      schY={12}
      pcbX="12.5mm"
      pcbY="0mm"
      pcbRotation={270}
      layer="bottom"
      connections={{
        VCC: "net.VCC",
        GND: "net.GND",
        "1A": "net.RC_DELAY",
        "1Y": "net.RESET_INV1",
        "2A": "net.RESET_INV1",
        "2Y": "net.RESET_DELAYED",
        "3A": "net.GND",
        "4A": "net.GND",
        "5A": "net.GND",
        "6A": "net.GND",
      }}
    />
    <resistor
      name="R_RESET"
      resistance="220k"
      footprint="axial_p7.62mm"
      schX={8}
      schY={12}
      pcbX="-10mm"
      pcbY="0mm"
      pcbRotation={90}
      layer="bottom"
      connections={{
        pin1: "net.VCC",
        pin2: "net.RC_DELAY",
      }}
    />
    <PolarizedCap
      name="C_RESET"
      capacitance="10uF"
      footprint="axial_p7.62mm"
      polarized
      schX={10}
      schY={10}
      pcbX="23mm"
      pcbY="0mm"
      pcbRotation={90}
      layer="bottom"
      connections={{
        pin1: "net.RC_DELAY",
        pin2: "net.GND",
      }}
    />

    {/* LM358 Audio Op-Amp Stage */}
    <resistor
      name="R_FB"
      resistance="1k"
      footprint="axial_p7.62mm"
      pcbX="-17mm"
      pcbY="0mm"
      pcbRotation={90}
      layer="bottom"
      schX={34}
      schY={6}
      connections={{
        pin1: "net.SUM_NODE",
        pin2: "net.OPAMP_OUT",
      }}
    />
    <capacitor
      name="C_AMP"
      capacitance="0.1uF"
      footprint="axial_p7.62mm"
      pcbX="-13.5mm"
      pcbY="0mm"
      pcbRotation={90}
      layer="bottom"
      schX={32}
      schY={-4}
      connections={{
        pin1: "net.VCC",
        pin2: "net.GND",
      }}
    />
    <LM358
      name="U_AMP"
      pcbX="-2.5mm"
      pcbY="0mm"
      schX={28}
      schY={2}
      pcbRotation={270}
      layer="bottom"
      connections={{
        VCC: "net.VCC",
        GND: "net.GND",
        IN1_POS: "net.GND",         // Pin 3: Tied to Ground
        IN1_NEG: "net.SUM_NODE",    // Pin 2: Connected directly to summing node
        OUT1: "net.OPAMP_OUT",      // Pin 1: Op-amp Output
        IN2_POS: "net.GND",         // Pin 5: Unused section - input tied to GND
        IN2_NEG: "net.AMP_UNUSED_FB", // Pin 6: Unused section - shorted to output
        OUT2: "net.AMP_UNUSED_FB",   // Pin 7: Unity-gain follower (output = GND)
      }}
    />
    <PolarizedCap
      name="C_AUDIO_OUT"
      capacitance="10uF"
      footprint="axial_p7.62mm"
      polarized
      pcbX="-20.5mm"
      pcbY="0mm"
      layer="bottom"
      pcbRotation={90}
      schX={40}
      schY={2}
      connections={{
        pin1: "net.CAP_PLUS",    // Positive (+) from Series Resistor
        pin2: "net.SUM_NODE",    // Negative (-) to SUM_NODE / Exaudio (Eagle Active Shunt)
      }}
    />
  </group>
);
