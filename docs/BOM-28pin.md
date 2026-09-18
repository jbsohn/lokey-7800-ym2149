# Bill of Materials — 28-Pin Board

Signal-level detail: [Hardware-28pin.md](Hardware-28pin.md).

Passive ratings are not fixed by the design; recommended defaults:

- **Resistor**: 1/4 W axial, 5% carbon/metal film
- **Ceramic**: 50 V ceramic (X7R/C0G)
- **Electrolytic**: aluminium electrolytic, >= 25 V, observe polarity

## Build notes (v0.2 — read before populating)

Two bodge wires get a v0.2 board booting and playing sound for the most part — everything else below is an optional refinement, not required to get a working board:

1. **ROM pin 22 (`/OE`) → GND**, landed on ROM pin 14 (also GND). A known freerouting/zone-fill quirk can leave this pad disconnected from the GND pour despite the design tying it to ground in source — verify continuity after assembly and bodge if missing. See `docs/PCB-Revisions-v0.2.md` §1.
2. **`SUM_NODE` (LM358 pin 2) → `C_AUDIO_OUT` pin 2 (`Exaudio`, cart pin 18)**. Already fixed at the source level (`Exaudio` ties directly to `SUM_NODE` in `pcb/28pin.circuit.tsx`) — only needed if populating a board fabbed before that fix. See `docs/PCB-Revisions-v0.2.md` §2.

Optional refinements (board works without either of these, just with some rough edges):

- **Silences BIOS-boot startup noise:** swap `R_RESET`/`C_RESET` for a CD40106 Schmitt-trigger reset-delay circuit — see "Optional: reset-delay circuit" below. Skip it and the board still boots into music, just with a burst of static/garble during the ~1.5s BIOS boot first. **Confirmed working on real hardware 2026-09-17.**
- **Chord-clipping headroom:** `R_YM_AUDIOA/B/C` below are 3k (raised from 1k) so a full 3-voice chord at max volume doesn't clip the LM358. **Not yet bench-confirmed** against a real chord — the original 1k plays fine otherwise.

## Integrated circuits

| Ref | Part | Package | Layer | Function |
| --- | --- | --- | --- | --- |
| U_AMP | LM358 | DIP-8, 0.3" | bottom | Dual op-amp — audio summing / output stage |
| U_GAL | ATF16V8B | DIP-20, 0.3" | top | Address-decode / bus-control PLD, programmed with pld/*.pld (make logic) |
| U_LATCH | 74HCT373 | DIP-20, 0.3" | top | Octal transparent latch — D0-D7 to YM DA0-DA7 |
| U_ROM | 27C256 | DIP-28, 0.6" | top | Program ROM (image burned per build) |
| U_YM | YM2149 | DIP-40, 0.6" | top | Programmable sound generator (AY-3-8910 largely pin-compatible) |

## Resistors

| Ref | Value | Connections | Layer | Function |
| --- | --- | --- | --- | --- |
| R_FB | 1k | SUM_NODE / OPAMP_OUT | bottom | LM358 inverting-stage feedback resistor |
| R_PULL | 1k | OPAMP_OUT / GND | top | Class-A bias / output pulldown |
| R_RESET | 10k | VCC / RESET_DELAYED | bottom | Reset RC pull-up (with C_RESET), ~100 ms YM release delay — **optional**: skip and use the CD40106 alternative below instead if you want BIOS-boot startup noise silenced |
| R_SERIES | 1k | OPAMP_OUT / CAP_PLUS | top | Output series resistor into AC-coupling cap |
| R_YM_AUDIOA | 3k | ANALOG_A / SUM_NODE | top | Channel A isolation resistor into LM358 summing node (raised from 1k for chord headroom, untested) |
| R_YM_AUDIOB | 3k | ANALOG_B / SUM_NODE | top | Channel B isolation resistor into LM358 summing node (raised from 1k for chord headroom, untested) |
| R_YM_AUDIOC | 3k | ANALOG_C / SUM_NODE | top | Channel C isolation resistor into LM358 summing node (raised from 1k for chord headroom, untested) |

## Capacitors

| Ref | Value | Type | Connections | Layer | Populate? | Function |
| --- | --- | --- | --- | --- | --- | --- |
| C_AMP | 0.1uF | ceramic | VCC / GND | bottom | Yes | U_AMP supply decoupling |
| C_AUDIO_OUT | 10uF | electrolytic, polarized | CAP_PLUS / OPAMP_OUT_AC | bottom | **Required** | AC-couples audio to Exaudio (cart pin 18) |
| C_BULK | 10uF | electrolytic, polarized | VCC / GND | bottom | Optional | Bulk rail reservoir / decoupling — Board runs without it; console rail + 0.1 uF caps cover it. OK to leave unpopulated. |
| C_GAL | 0.1uF | ceramic | VCC / GND | top | Yes | U_GAL supply decoupling |
| C_LATCH | 0.1uF | ceramic | VCC / GND | top | Yes | U_LATCH supply decoupling |
| C_RESET | 10uF | electrolytic, polarized | RESET_DELAYED / GND | bottom | Optional | Reset delay timing cap (with R_RESET) — skip and use the CD40106 alternative below instead if you want BIOS-boot startup noise silenced |
| C_ROM | 0.1uF | ceramic | VCC / GND | top | Yes | U_ROM supply decoupling |
| C_YM | 0.1uF | ceramic | VCC / GND | top | Yes | U_YM supply decoupling |

## Optional: CD40106 reset-delay circuit (silences BIOS-boot noise)

Replaces `R_RESET`/`C_RESET` — lands on their existing pads (VCC, `RESET_DELAYED`/YM Pin 23, GND). Not yet in `pcb/28pin.circuit.tsx` source/layout (hand-wired for now); full pinout and wiring in `docs/Hardware-28pin.md` §4. **Confirmed working on real hardware 2026-09-17.**

| Part | Value | Package | Function |
| --- | --- | --- | --- |
| CD40106 | Hex Schmitt-trigger inverter | DIP-14, 0.3" | 2 of 6 gates buffer the RC below and drive YM Pin 23 directly — confirmed clean at these values |
| R (replaces R_RESET) | 220k | Axial, 7.62 mm pitch | RC timing resistor, VCC → node |
| C (replaces C_RESET) | 10uF, electrolytic | Axial, 7.62 mm pitch | RC timing cap, node → GND (`+` on the node side) — same value as `C_RESET`, can reuse |

## Board features — not populated parts

| Ref | What it is |
| --- | --- |
| J1 | Atari 7800 cartridge edge connector — gold PCB fingers, part of the board |
| JP1 | Solder jumper — ROM pin 1 (VPP / A15) ROM-size select |
| JP2 | Solder jumper — ROM pin 27 (A14) ROM-size select |
| U6 | GND-plane stitching via — plated hole only |
| U7 | GND-plane stitching via — plated hole only |

## Pick list

| Qty | Part / Value | Package | Designators |
| --- | --- | --- | --- |
| 1 | 27C256 | DIP-28, 0.6" | U_ROM |
| 1 | 74HCT373 | DIP-20, 0.3" | U_LATCH |
| 1 | ATF16V8B | DIP-20, 0.3" | U_GAL |
| 1 | LM358 | DIP-8, 0.3" | U_AMP |
| 1 | YM2149 | DIP-40, 0.6" | U_YM |
| 5 | 0.1uF | Axial, 7.62 mm pitch | C_AMP, C_GAL, C_LATCH, C_ROM, C_YM |
| 3 | 10uF | Axial, 7.62 mm pitch | C_AUDIO_OUT, C_BULK, C_RESET |
| 1 | 10k | Axial, 7.62 mm pitch | R_RESET (skip if using the optional CD40106 circuit instead) |
| 3 | 1k | Axial, 7.62 mm pitch | R_FB, R_PULL, R_SERIES |
| 3 | 3k | Axial, 7.62 mm pitch | R_YM_AUDIOA, R_YM_AUDIOB, R_YM_AUDIOC |

If adding the optional CD40106 reset-delay circuit: also need 1x CD40106, DIP-14, 0.3", and 1x 220k axial resistor. The 10uF `C_RESET` above can serve directly as its timing cap either way.

## Sockets (recommended, not on silkscreen)

| For | Socket |
| --- | --- |
| U_AMP | DIP, 0.3" (optional) |
| U_GAL | DIP, 0.3" |
| U_LATCH | DIP, 0.3" (optional) |
| U_ROM | DIP, 0.6" |
| U_YM | DIP, 0.6" |

### ROM size — `JP1` / `JP2` settings

| ROM | `JP1` (pin 1, VPP/A15) | `JP2` (pin 27, A14) | Accessible |
| :-- | :-- | :-- | :-- |
| 16 KB (27C128) | Bridge Left (VCC) | Bridge Left (VCC) | 16 KB mirrored `$4000-$FFFF` |
| 32 KB (27C256) | Bridge Left (VCC) | Bridge Right (A14) | 32 KB `$8000-$FFFF` |
| 64 KB (27C512) | Bridge Right (A15) | Bridge Right (A14) | 48 KB `$4000-$FFFF` unmirrored |
