import { type ChipProps } from "tscircuit";

interface SolderJumperProps extends ChipProps {
  label?: string;
  labelL?: string;
  labelR?: string;
}

export const SolderJumper = ({ label, labelL, labelR, ...props }: SolderJumperProps) => (
  <chip
    {...props}
    pinLabels={{
      1: "L", // Option A (e.g. VCC)
      2: "C", // Center / Common (connects to ROM pin)
      3: "R", // Option B (e.g. Address line)
    }}
  >
    {/* A solder jumper, not a cable connector: "from_above" opts out of tscircuit's J-prefix orientation check. */}
    <footprint insertionDirection="from_above">
      {/* Three SMT pads close together for easy solder bridging */}
      <smtpad
        shape="rect"
        width="1.2mm"
        height="2.0mm"
        pcbX="-1.5mm"
        pcbY="0mm"
        layer={props.layer}
        portHints={["pin1"]}
      />
      <smtpad
        shape="rect"
        width="1.2mm"
        height="2.0mm"
        pcbX="0mm"
        pcbY="0mm"
        layer={props.layer}
        portHints={["pin2"]}
      />
      <smtpad
        shape="rect"
        width="1.2mm"
        height="2.0mm"
        pcbX="1.5mm"
        pcbY="0mm"
        layer={props.layer}
        portHints={["pin3"]}
      />
      {label && (
        <silkscreentext
          pcbX={0}
          pcbY={1.6}
          text={label}
          fontSize="0.8mm"
          layer={props.layer}
        />
      )}
      {labelL && (
        <silkscreentext
          pcbX={-1.5}
          pcbY={-2.3}
          text={labelL}
          fontSize="0.8mm"
          layer={props.layer}
        />
      )}
      {labelR && (
        <silkscreentext
          pcbX={1.5}
          pcbY={-2.3}
          text={labelR}
          fontSize="0.8mm"
          layer={props.layer}
        />
      )}
    </footprint>
  </chip>
);
