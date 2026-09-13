# Bill of Materials — 32-Pin Board

Signal-level detail: [Hardware-32pin.md](Hardware-32pin.md).

Passive ratings are not fixed by the design; recommended defaults:

- **Resistor**: 1/4 W axial, 5% carbon/metal film
- **Ceramic**: 50 V ceramic (X7R/C0G)
- **Electrolytic**: aluminium electrolytic, >= 25 V, observe polarity

## Integrated circuits

| Ref | Part | Package | Layer | Function |
| --- | --- | --- | --- | --- |
| U_AMP | LM358 | DIP-8, 0.3" | bottom | Dual op-amp — audio summing / output stage |
| U_GAL | ATF22V10 | DIP-24, 0.3" | top | Address-decode / bus-control PLD, programmed with pld/*.pld (make logic) |
| U_LATCH | 74HCT373 | DIP-20, 0.3" | top | Octal transparent latch — D0-D7 to YM DA0-DA7 |
| U_ROM | 27C010/27C020/27C040 | DIP-32, 0.6" | top | Program ROM (image burned per build) |
| U_YM | YM2149 | DIP-40, 0.6" | top | Programmable sound generator (AY-3-8910 largely pin-compatible) |

## Resistors

| Ref | Value | Connections | Layer | Function |
| --- | --- | --- | --- | --- |
| R_BANK0 | 10k | VCC / YM_IOA0 | bottom | YM IOA0 power-up pull-up (bank select) |
| R_BANK1 | 10k | VCC / YM_IOA1 | bottom | YM IOA1 power-up pull-up (bank select) |
| R_BANK2 | 10k | VCC / YM_IOA2 | bottom | YM IOA2 power-up pull-up (bank select) |
| R_BANK3 | 10k | VCC / YM_IOA3 | bottom | YM IOA3 power-up pull-up (bank select) |
| R_FB | 1k | SUM_NODE / OPAMP_OUT | bottom | LM358 inverting-stage feedback resistor |
| R_PULL | 1k | OPAMP_OUT / GND | bottom | Class-A bias / output pulldown |
| R_RESET | 10k | VCC / RESET_DELAYED | top | Reset RC pull-up (with C_RESET), ~100 ms YM release delay |
| R_SERIES | 1k | OPAMP_OUT / CAP_PLUS | bottom | Output series resistor into AC-coupling cap |
| R_YM_AUDIOA | 1k | ANALOG_A / SUM_NODE | top | Channel A isolation resistor into LM358 summing node |
| R_YM_AUDIOB | 1k | ANALOG_B / SUM_NODE | top | Channel B isolation resistor into LM358 summing node |
| R_YM_AUDIOC | 1k | ANALOG_C / SUM_NODE | top | Channel C isolation resistor into LM358 summing node |

## Capacitors

| Ref | Value | Type | Connections | Layer | Populate? | Function |
| --- | --- | --- | --- | --- | --- | --- |
| C_AMP | 0.1uF | ceramic | VCC / GND | bottom | Yes | U_AMP supply decoupling |
| C_AUDIO_OUT | 10uF | electrolytic, polarized | CAP_PLUS / OPAMP_OUT_AC | bottom | **Required** | AC-couples audio to Exaudio (cart pin 18) |
| C_BULK | 10uF | electrolytic, polarized | VCC / GND | bottom | Optional | Bulk rail reservoir / decoupling — Board runs without it; console rail + 0.1 uF caps cover it. OK to leave unpopulated. |
| C_GAL | 0.1uF | ceramic | VCC / GND | top | Yes | U_GAL supply decoupling |
| C_LATCH | 0.1uF | ceramic | VCC / GND | top | Yes | U_LATCH supply decoupling |
| C_RESET | 10uF | electrolytic, polarized | RESET_DELAYED / GND | top | **Required** | Reset delay timing cap (with R_RESET) |
| C_ROM | 0.1uF | ceramic | VCC / GND | top | Yes | U_ROM supply decoupling |
| C_YM | 0.1uF | ceramic | VCC / GND | top | Yes | U_YM supply decoupling |

## Board features — not populated parts

| Ref | What it is |
| --- | --- |
| J1 | Atari 7800 cartridge edge connector — gold PCB fingers, part of the board |
| U6 | GND-plane stitching via — plated hole only |
| U7 | GND-plane stitching via — plated hole only |

## Pick list

| Qty | Part / Value | Package | Designators |
| --- | --- | --- | --- |
| 1 | 27C010/27C020/27C040 | DIP-32, 0.6" | U_ROM |
| 1 | 74HCT373 | DIP-20, 0.3" | U_LATCH |
| 1 | ATF22V10 | DIP-24, 0.3" | U_GAL |
| 1 | LM358 | DIP-8, 0.3" | U_AMP |
| 1 | YM2149 | DIP-40, 0.6" | U_YM |
| 5 | 0.1uF | Axial, 7.62 mm pitch | C_AMP, C_GAL, C_LATCH, C_ROM, C_YM |
| 3 | 10uF | Axial, 7.62 mm pitch | C_AUDIO_OUT, C_BULK, C_RESET |
| 5 | 10k | Axial, 7.62 mm pitch | R_BANK0, R_BANK1, R_BANK2, R_BANK3, R_RESET |
| 6 | 1k | Axial, 7.62 mm pitch | R_FB, R_PULL, R_SERIES, R_YM_AUDIOA, R_YM_AUDIOB, R_YM_AUDIOC |

## Sockets (recommended, not on silkscreen)

| For | Socket |
| --- | --- |
| U_AMP | DIP, 0.3" (optional) |
| U_GAL | DIP, 0.3" |
| U_LATCH | DIP, 0.3" (optional) |
| U_ROM | DIP, 0.6" |
| U_YM | DIP, 0.6" |

### Banking

`R_BANK0..3` (10 k) pull YM `IOA0-IOA3` high at power-up so the cartridge boots from bank 15 (a mirror of the fixed `$8000-$FFFF` region) before software selects a bank. See Hardware-32pin.md.
