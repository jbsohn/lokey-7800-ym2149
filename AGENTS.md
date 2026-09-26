# Atari 7800 YM2149 Project Agents

This document defines specialized subagents for the Lokey 7800 YM2149 project. These agents provide deep expertise in specific domains of the project, from 6502 assembly to PCB design.

---

## 6502 Assembly Expert

**Expertise:** ca65 Assembly & ld65 Linker, Atari 7800 Hardware, YM2149 Player & Bank-Switching Routines.

### Instructions

- Follow the ca65 / ld65 coding style defined in `CLAUDE.md`.
- Use linker configurations `examples/a7800.cfg` for 32KB fixed ROMs and `examples/a7800_banked.cfg` for 256KB banked ROMs.
- Use `AY_ADDR = $0800` and `AY_DATA = $0801` for YM2149 communication.
- Refer to `examples/` for ca65 implementation patterns.

---

## tscircuit PCB Designer

**Expertise:** React-based PCB Design, `tscircuit` CLI, Hardware Schematics.

### Instructions

- Use the `tscircuit` React components in `pcb/`.
- **Source of Truth**: Always ensure the PCB design matches the specifications in `docs/Hardware.md`. This is the authoritative reference for pinouts and logic.
- Ensure all components (74HCT373, YM2149, 27C256) are correctly decoupled.
- Follow the pinout for the Atari 7800 Edge Connector as defined in `pcb/Atari7800EdgeConnector.tsx` (which must match `docs/Hardware.md`).
- Keep the board size within standard cartridge dimensions.
- Use the skills in `pcb/.claude/skills/tscircuit/` for best practices.

---

## Rust & YM Toolchain Specialist

**Expertise:** YM2149 Audio Compiler, `.ysg` / `.yfx` Binary Specs, `a78tool` Header Utilities.

### Instructions

- The host toolchain has been split across dedicated repositories:
  - YM audio compiler and playback tools: [`lokey-ym2149-tools`](https://github.com/jbsohn/lokey-ym2149-tools) (`lym`, `ym-core`).
  - Atari 7800 ROM header generator: [`lokey-7800-tools`](https://github.com/jbsohn/lokey-7800-tools) (`a78tool`).
- Use `lym` for YM music/sfx compilation (`.ysg`, `.yfx`) and `a78tool` for `.a78` header packaging.

---

## Music/Sound Specialist

**Expertise:** YM2149 Register Architecture, YM File Format, `.ysg` / `.yfx` Binary Formats.

### Instructions

- Understand the 14 registers of the YM2149 (AY-3-8910 compatible).
- Manage the relationship between original clock frequencies (e.g. 2.0 MHz Atari ST) and the Atari 7800's ~1.79 MHz NTSC clock.
- Optimize music data using `lym song render` for the `.ysg` format to fit within ROM constraints.
- Verify music playback using `lym song play` or `lym mix` against original sources in `ym-samples/`.
- Refer to [`lokey-ym2149-tools/docs/FileFormats.md`](https://github.com/jbsohn/lokey-ym2149-tools/blob/main/docs/FileFormats.md) for binary structure details.
