import { type ChipProps } from "tscircuit";

/**
 * 3.2mm x 2.5mm 4-SMD Crystal Oscillator (HELE X3S027000BA1H-U or equivalent).
 * Matches LCSC part C136079 used in the AVR PSG project.
 */
export const Crystal3225 = (props: ChipProps) => (
  <chip
    {...props}
    manufacturerPartNumber="X3S027000BA1H-U"
    pinLabels={{
      1: "XTAL1",
      2: "GND",
      3: "XTAL2",
      4: "GND_2",
    }}
    schPinArrangement={{
      leftSide: { pins: ["XTAL1", "XTAL2"], direction: "top-to-bottom" },
      rightSide: { pins: ["GND", "GND_2"], direction: "top-to-bottom" },
    }}
  >
    <footprint>
      <smtpad
        shape="rect"
        pcbX="-1.1mm"
        pcbY="0.85mm"
        width="1.2mm"
        height="1.0mm"
        portHints={["pin1"]}
      />
      <smtpad
        shape="rect"
        pcbX="1.1mm"
        pcbY="0.85mm"
        width="1.2mm"
        height="1.0mm"
        portHints={["pin2"]}
      />
      <smtpad
        shape="rect"
        pcbX="1.1mm"
        pcbY="-0.85mm"
        width="1.2mm"
        height="1.0mm"
        portHints={["pin3"]}
      />
      <smtpad
        shape="rect"
        pcbX="-1.1mm"
        pcbY="-0.85mm"
        width="1.2mm"
        height="1.0mm"
        portHints={["pin4"]}
      />
    </footprint>
  </chip>
);
