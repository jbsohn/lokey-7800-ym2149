# 32-Pin Board — Theory of Operation & Hardware Spec

This document covers the **32-pin ROM board** (`pcb/32pin.circuit.tsx`): a single-YM2149 cartridge with DIP-32 EPROM socket (128KB–256KB) and YM IOA bank switching. For shared memory mapping and cartridge connector pinouts, see [Hardware.md](Hardware.md). For the 28-pin board, see [Hardware-28pin.md](Hardware-28pin.md).

---

## 1. Programmable Logic Device (ATF22V10) & `galette`

The 32-pin board uses a 24-pin **ATF22V10 PLD** (`U_GAL`). It performs both address decoding ($0800/$0801 sound writes and $4000–$FFFF ROM reads) *and* ROM bank mapping: YM2149 IOA pins feed the PLD, which generates ROM upper address lines `ROMA14–ROMA17`.

Logic sources are compiled into JEDEC fusemaps (`.jed`) using [**galette**](https://github.com/simon-frankau/galette):

```bash
make logic
```

### PLD Equations (`pld/rom_ym_32pin.pld`)

```cupl
PHI2OUT = PHI2
BDIR = /A15 * /A14 * /A13 * /A12 * A11 * /RW * HALT * PHI2
BC1  = /A15 * /A14 * /A13 * /A12 * A11 * /RW * /A0 * HALT * PHI2
YMLE = /A15 * /A14 * /A13 * /A12 * A11 * /RW * HALT * PHI2

/ROMCE  = A15 * RW  +  /A15 * A14 * RW
ROMA14  = A15 * A14 +  /A15 * IOA0
ROMA15  = A15 + IOA1
ROMA16  = A15 + IOA2
ROMA17  = A15 + IOA3
```

- **Fixed Bank (`$8000–$FFFF`)**: `A15=1` forces upper ROM address lines `ROMA15–ROMA17` high, locking execution to the top 32KB of the EPROM regardless of IOA state. `ROMA14` follows console `A14`.
- **Switched Data Window (`$4000–$7FFF`)**: `A15=0` and `A14=1` routes YM `IOA0–IOA3` to `ROMA14–ROMA17`, selecting 16KB bank *N*.

---

## 2. Memory Layout & Software Protocol

| Address Range | Function | ROM Mapping |
| :--- | :--- | :--- |
| **$8000–$FFFF** | **Fixed 32KB Code Bank** | Top 32KB of ROM (always mapped, ignores IOA) |
| **$4000–$7FFF** | **Switched 16KB Window** | Bank *N* (0..13) selected via YM2149 IOA port |

### Bank Selection Protocol

1. Write YM reg 7 (Mixer): set bit 6 = `1` (IOA = output mode, preserve mixer bits 0–5).
2. Write YM reg 14 (IOA): set bits [3:0] = bank number (16KB units).

> **Power-On Reset State:** At power-up, YM IOA is in input mode (Hi-Z). 10kΩ pull-ups on `IOA0–IOA3` select bank 15 (a mirror of the fixed region), ensuring safe initial boot without requiring vector duplication.

---

## 3. Hardware Pinouts & Connections

### ATF22V10 PLD Pinout (`U_GAL`)

| Pin | Signal | Source / Destination |
| :--- | :--- | :--- |
| 1 | PHI2 | 7800 CPU Clock (Cart Pin 32) |
| 2 | A15 | 7800 Address Bus |
| 3 | A14 | 7800 Address Bus |
| 4 | A13 | 7800 Address Bus |
| 5 | A12 | 7800 Address Bus |
| 6 | A11 | 7800 Address Bus |
| 7 | A0 | 7800 Address Bus |
| 8 | R/W | 7800 CPU R/W Line |
| 9 | HALT | 7800 Maria Halt Signal |
| 10 | IOA0 | ← U_YM Pin 21 (bank bit 0) |
| 11 | IOA1 | ← U_YM Pin 20 (bank bit 1) |
| 12 | GND | Ground |
| 13 | IOA2 | ← U_YM Pin 19 (bank bit 2) |
| 14 | IOA3 | ← U_YM Pin 18 (bank bit 3) |
| 15 | **ROM_A14** | → U_ROM Pin 29 (A14) |
| 16 | **ROM_A15** | → U_ROM Pin 3 (A15) |
| 17 | **ROM_A16** | → U_ROM Pin 2 (A16) |
| 18 | **ROM_A17** | → U_ROM Pin 30 (A17) |
| 19 | **!ROM_CE** | → U_ROM Pin 22 (~CE) |
| 20 | **BC1** | → U_YM Pin 29 |
| 21 | **BDIR** | → U_YM Pin 27 |
| 22 | **PHI2OUT** | Buffered Clock → U_YM Pin 22 |
| 23 | **YM_LE** | Latch Enable → 74HCT373 Pin 11 |
| 24 | VCC | +5V |

### 74HCT373 Octal Latch (`U_LATCH`)

| Latch Pin | Signal | Connection |
| :--- | :--- | :--- |
| 1 | ~OE | Ground |
| 2–9 | Q0–Q7 | U_YM DA0–DA7 |
| 3–18 | D0–D7 | 7800 Data Bus D0–D7 |
| 11 | LE | PLD Pin 23 (`YM_LE`) |
| 20 | VCC | +5V |
| 10 | GND | Ground |

### DIP-32 ROM Socket (`U_ROM` — AT27C010 / AT27C020 / AT27C040)

- Pins 0–13: Address bus A0–A13 from 7800 Console.
- Pins 29, 3, 2, 30: Address lines A14–A17 from PLD (Pins 15–18).
- Pin 31 (PGM/A18): Tied to VCC (forces upper 256KB on AT27C040).
- Pin 22 (~CE): Driven by PLD Pin 19 (`!ROM_CE`). Pin 24 (~OE) tied to GND.

### YM2149 PSG (`U_YM`)

- **Control & Bus**: `BDIR` ← PLD Pin 21, `BC1` ← PLD Pin 20, `CLOCK` ← PLD Pin 22 (`PHI2OUT`).
- **IOA Bank Lines**: Pins 21, 20, 19, 18 (`IOA0–IOA3`) feed PLD Pins 10, 11, 13, 14 with 10kΩ pull-ups to VCC.

---

## 4. Analog & Reset Subsystems

- **Reset Delay**: 10kΩ pull-up to VCC + 10µF capacitor to GND on YM Pin 23 (`!RESET`) (~100ms reset pulse).
- **Audio Stage**: Based on and adapted from Eagle's cartridge audio design on the AtariAge forums ([thread discussion](https://forums.atariage.com/topic/389754-atari-7800ym2149-clone-prototype/)).
