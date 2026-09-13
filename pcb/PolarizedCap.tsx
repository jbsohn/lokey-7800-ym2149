import { type CapacitorProps } from "tscircuit";

// Axial electrolytic capacitor with "+" / "-" polarity silkscreen.
//
// tscircuit's polarized-capacitor convention is pin1 = "+" (anode),
// pin2 = "-" (cathode). The marker X offsets (-/+3.81 mm) sit directly over
// the two leads of the axial 7.62 mm (0.3") pitch footprint used on both
// boards; if the lead pitch ever changes, update these offsets to match.
export const PolarizedCap = (props: CapacitorProps) => (
  <capacitor {...props} polarized>
    <silkscreentext
      text="+"
      pcbX="-3.81mm"
      pcbY="1.6mm"
      fontSize="1mm"
      anchorAlignment="bottom_center"
      layer={props.layer}
    />
    <silkscreentext
      text="-"
      pcbX="3.81mm"
      pcbY="1.6mm"
      fontSize="1mm"
      anchorAlignment="bottom_center"
      layer={props.layer}
    />
  </capacitor>
);
