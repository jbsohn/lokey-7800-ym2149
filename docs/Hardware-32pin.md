# 32-Pin Board — Theory of Operation & Hardware Spec

This document covers the **32-pin ROM board** (`pcb/32pin.circuit.tsx`): a single-YM2149 cartridge with DIP-32 EPROM socket (128KB–256KB) and YM IOA bank switching. For shared memory mapping and cartridge connector pinouts, see [Hardware.md](Hardware.md). For the 28-pin board, see [Hardware-28pin.md](Hardware-28pin.md).

---

## Programmable Logic Device (ATF22V10) & `galette`

The 32-pin board uses a 24-pin **ATF22V10 PLD** (`U_GAL`). It performs both address decoding ($0800/$0801 sound writes and $4000–$FFFF ROM reads) *and* ROM bank mapping: YM2149 IOA pins feed the PLD, which generates ROM upper address lines `ROMA14–ROMA17`.

Logic sources are compiled into JEDEC fusemaps (`.jed`) using [**galette**](https://github.com/simon-frankau/galette):

```bash
make logic
```

### PLD Equations (`pld/rom_ym_32pin.pld`)

```cupl
BDIR = /A15 * /A14 * /A13 * /A12 * A11 * /RW * HALT * PHI2
BC1  = /A15 * /A14 * /A13 * /A12 * A11 * /RW * /A0 * HALT * PHI2

/ROMCE  = A15 * RW  +  /A15 * A14 * RW
ROMA14  = A15 * A14 +  /A15 * IOA0
ROMA15  = A15 + IOA1
ROMA16  = A15 + IOA2
ROMA17  = A15 + IOA3
ROMA18  = A15 + IOA4
```

- **Fixed Bank (`$8000–$FFFF`)**: `A15=1` forces upper ROM address lines `ROMA15–ROMA18` high, locking execution to the top 32KB of the ROM (Banks 30 & 31) regardless of IOA state. `ROMA14` follows console `A14`.
- **Switched Data Window (`$4000–$7FFF`)**: `A15=0` and `A14=1` routes YM `IOA0–IOA4` to `ROMA14–ROMA18`, selecting 16KB bank *N* (Banks 0–29).

---

## Memory Layout & Software Protocol

| Address Range | Function | ROM Mapping |
| :--- | :--- | :--- |
| **$8000–$FFFF** | **Fixed 32KB Code Bank** | Top 32KB of ROM (always mapped, ignores IOA) |
| **$4000–$7FFF** | **Switched 16KB Window** | Bank *N* (0..29) selected via YM2149 IOA port |

### Bank Selection Protocol

1. Write YM reg 7 (Mixer): set bit 6 = `1` (IOA = output mode, preserve mixer bits 0–5).
2. Write YM reg 14 (IOA): set bits [4:0] = bank number (16KB units).

> **Power-On Reset State:** At power-up, YM IOA is in input mode (Hi-Z). Five 10kΩ pull-ups on `IOA0–IOA4` select bank 31 (a mirror of the fixed region), ensuring safe initial boot without requiring vector duplication.

---

## Hardware Pinouts & Connections

### ATF22V10 PLD Pinout (`U_GAL`)

| Pin | Signal | Source / Destination |
| :--- | :--- | :--- |
| 1 | PHI2 | 7800 CPU Clock (Cart Pin 32) |
| 2 | HALT | 7800 Maria Halt Signal |
| 3 | R/W | 7800 CPU R/W Line |
| 4 | A0 | 7800 Address Bus |
| 5 | A11 | 7800 Address Bus |
| 6 | A12 | 7800 Address Bus |
| 7 | A13 | 7800 Address Bus |
| 8 | A14 | 7800 Address Bus |
| 9 | A15 | 7800 Address Bus |
| 10 | IOA0 | ← U_YM Pin 21 (bank bit 0) |
| 11 | IOA1 | ← U_YM Pin 20 (bank bit 1) |
| 12 | GND | Ground |
| 13 | IOA2 | ← U_YM Pin 19 (bank bit 2) |
| 14 | IOA3 | ← U_YM Pin 18 (bank bit 3) |
| 15 | IOA4 | ← U_YM Pin 17 (bank bit 4, 512KB) |
| 16 | **ROM_A14** | → U_ROM Pin 29 (A14) |
| 17 | **ROM_A15** | → U_ROM Pin 3 (A15) |
| 18 | **ROM_A16** | → U_ROM Pin 2 (A16) |
| 19 | **ROM_A17** | → U_ROM Pin 30 (A17) |
| 20 | **ROM_A18** | → JP_A18 (DIP Pin 31) / U_ROM_PLCC Pin 1 |
| 21 | **!ROM_CE** | → U_ROM Pin 22 (~CE) |
| 22 | **BC1** | → U_YM Pin 29 |
| 23 | **BDIR** | → U_YM Pin 27 & U_LATCH Pin 11 (`LE`) |
| 24 | VCC | +5V |

### 74HCT373 Octal Latch (`U_LATCH`)

| Latch Pin | Signal | Connection |
| :--- | :--- | :--- |
| 1 | ~OE | Ground |
| 2–9 | Q0–Q7 | U_YM DA0–DA7 |
| 3–18 | D0–D7 | 7800 Data Bus D0–D7 |
| 11 | LE | PLD Pin 23 (`BDIR`) |
| 20 | VCC | +5V |
| 10 | GND | Ground |

### ROM Sockets (Dual Footprint: DIP-32 `U_ROM` or PLCC-32 `U_ROM_PLCC`)

The 32-pin board features a **nested combo footprint** on the top layer, allowing the developer to populate **either** a through-hole DIP-32 socket or a surface-mount PLCC-32 socket (mutually exclusive):

1. **Through-Hole DIP-32 Socket (`U_ROM`)**:
   - For UV EPROMs (`AT27C010`, `AT27C020`, `AT27C040`, `M27C2001`) or DIP Flash.
   - Pin 31 configured via solder jumper `JP_A18`: bridged 1–2 for $V_{CC}$ (128K/256K EPROMs), bridged 2–3 for `ROMA18` (512K EPROMs).
2. **Surface-Mount PLCC-32 Socket (`U_ROM_PLCC`)**:
   - For standard 5V parallel Flash memory (`SST39SF010A`, `SST39SF020A`, `SST39SF040`, `AT29C010A`, `AT29C020A`).
   - Pin 1 directly connected to `ROMA18` (auto 512K on Flash, NC on 128K/256K); Pin 31 tied to $V_{CC}$ (Flash write-protect). Jumperless!

**Signal Mapping**:

- Pins 5–12, 4, 23, 25, 26, 27, 28: Address bus A0–A13 from 7800 Console.
- Pins 29, 3, 2, 30: Address lines A14–A17 from PLD (Pins 16–19).
- Pin 22 (~CE): Driven by PLD Pin 21 (`!ROM_CE`).
- Pin 24 (~OE): Tied to GND (output always enabled when chip selected).

### YM2149 PSG (`U_YM`)

- **Control & Bus**: `BDIR` ← PLD Pin 23, `BC1` ← PLD Pin 22, `CLOCK` ← Cart Pin 32 (`PHI2` direct).
- **IOA Bank Lines**: Pins 21, 20, 19, 18, 17 (`IOA0–IOA4`) feed PLD Pins 10, 11, 13, 14, 15 with 10kΩ pull-ups to VCC (`R_BANK0–R_BANK4`).

---

## Solder Jumper Configuration (DIP Pin 31)

The 32-pin board includes a 3-pad solder jumper `JP_A18` located on the top layer at the bottom-right of the DIP socket (`pcbX="21mm", pcbY="-11mm"`):

| Jumper | Left pad (1) | Center pad (2) | Right pad (3) |
| :--- | :--- | :--- | :--- |
| **JP_A18** | VCC (+5V) | DIP Pin 31 | ROM_A18 (GAL Pin 20) |

### ROM Selection

* **128 KB / 256 KB DIP EPROM (`27C010` / `27C020`)**: **Bridge Left (1–2 / `VCC`)**. Ties Pin 31 (`PGM#`) high to enable read mode.
- **512 KB DIP EPROM (`27C040`)**: **Bridge Right (2–3 / `512K`)**. Connects Pin 31 to `ROM_A18` from the GAL to select between the lower and upper 256KB halves.
- **PLCC Flash (`SST39SF010A` / `020A` / `040`)**: **Jumperless!** Pin 1 is wired directly to `ROM_A18` (auto 512K on Flash; NC on 128K/256K), and Pin 31 is tied to $V_{CC}$ (write-protect).

---

## Analog & Reset Subsystems

- **Reset Delay**: CD40106 Schmitt-trigger delay (same design as the 28-pin board — see `docs/Hardware-28pin.md` (Hardware Reset & Audio Stage) and `docs/PCB-Revisions-v0.2.md` (ERR-AUDIO-POP) for the full story, root cause, and rejected alternatives). Two gates of a CD40106 hex Schmitt-trigger inverter, wired as a non-inverting buffer, hold YM Pin 23 (`!RESET`) at hard GND through BIOS boot (~1.9s) then release it to VCC — driving Pin 23 directly, no separate pull-up needed.
  - RC timing: R=220kΩ (VCC → node), C=10µF (node → GND, electrolytic, `+` on the node side).
  - Physical v0.2 Prototype Note: The v0.2 32-pin prototype was fabricated with passive RC pads (`R_RESET`/`C_RESET`) and was bench-tested with Pin 23 tied high. The CD40106 active delay is integrated into the v0.3 layout (`pcb/32pin.circuit.tsx` via `pcb/YmResetAmp.tsx`) directly under the YM socket cavity to silence startup BIOS writes.
  - Production: CD40106 is the part currently in use and integrated into PCB source (`pcb/32pin.circuit.tsx`) via modular component `pcb/YmResetAmp.tsx` directly under the YM socket cavity. (74HC14 alternative rejected due to lower threshold $V_{T+} \approx 2.5\text{V}$ releasing reset prematurely during BIOS tests).
  - Confirmed on real 28-pin hardware; integrated into 32-pin PCB design and validated clean through Freerouting and DRC.
- **Audio Stage**: Based on and adapted from Eagle's cartridge audio design on the AtariAge forums ([thread discussion](https://forums.atariage.com/topic/389754-atari-7800ym2149-clone-prototype/)).
  - **Channel Summing**: `R_YM_AUDIOA/B/C` = 3kΩ (YM `ANALOG A/B/C` → `SUM_NODE`), `R_FB` = 1kΩ (`SUM_NODE` → `OPAMP_OUT`). Each channel gets ~1/3 gain into the LM358 inverting summing junction, so a full 3-voice chord at max volume lands back around a single channel's original headroom instead of stacking 3x — avoids clipping the single-supply LM358 near its rails. Same fix as the 28-pin board (`docs/Hardware-28pin.md`, Hardware Reset & Audio Stage) — originally 1kΩ/unity gain. Bench-tested clean on 2026-09-23 on the 32-pin board.
  - `R_PULL` = 1kΩ (`OPAMP_OUT` → GND), `R_SERIES` = 1kΩ (`OPAMP_OUT` → `CAP_PLUS`) into the AC-coupling cap to `Exaudio`.
