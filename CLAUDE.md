# CLAUDE.md

## Build Commands

- Build ROMs and `.a78` files: `make all`
- Build only logic ROMs and signed binaries: `make rom`
- Build only emulator-ready `.a78` files: `make a78`
- Build JEDEC files from `pld/*.pld` sources: `make logic`
- Build PCB gerbers (32-pin): `make pcb`
- Build PCB gerbers (28-pin): `make pcb-28pin`
- Clean all build artifacts: `make clean`

## External Repositories & Tooling

- **YM Sound & Music Toolchain**: [`lokey-ym2149-tools`](https://github.com/jbsohn/lokey-ym2149-tools) — Rust crate workspace (`lym`, `ym-core`).
- **Atari 7800 Header Tools**: [`lokey-7800-tools`](https://github.com/jbsohn/lokey-7800-tools) — Rust crate (`a78tool`).

## Code Style & Standards

### 6502 Assembly (ca65 / ld65)

- **Assembler / Linker**: Standardize on `ca65` and `ld65` (cc65 suite).
- **Formatting**: 8-space indentation for instructions, 0-space for labels.
- **Naming**: 
  - `UPPER_CASE` for constants, offsets, and hardware registers (e.g., `MSTAT`, `NUM_REGS`).
  - `snake_case` for labels, RAM variables, and code (e.g., `play_frame`, `music_ptr`).
- **Linker Configurations**: Use `examples/a7800.cfg` for 32KB fixed ROMs or `examples/a7800_banked.cfg` for 256KB banked ROMs.
- **Memory Map**:
  - YM2149 Address Register: `$0800`
  - YM2149 Data Register: `$0801`
  - Switched Bank Window: `$4000-$7FFF` (via YM2149 IOA port)
  - Fixed ROM Block: `$8000-$FFFF`

### PCB Design (tscircuit)

- **Source of Truth**: `docs/Hardware.md` is the authoritative source for hardware pinouts, memory maps, and signal logic. The `pcb/` project and all related code must always match what is defined in the hardware documentation.
- **Workflow**: Code-driven React components in `pcb/*.tsx`.
- **Standards**: 6 mil trace/space for signals, 16 mil for power.
- **Components**: Prefer standard DIP packages for hobbyist ease-of-assembly.

## Project Structure

- `examples/`: ca65 6502 assembly source files (`.s`), header equates (`.inc`), linker scripts (`.cfg`), and A78 header configs (`.json`).
- `docs/`: Hardware specs, PCB pipeline docs, and emulation references.
- `pld/`: Programmable logic (ATF16V8B / ATF22V10 PLD) sources (`.pld`).
- `pcb/`: tscircuit PCB design files (`28pin.circuit.tsx`, `32pin.circuit.tsx`) and the TypeScript build (`build-pcb.ts`, `freerouting-dsn.ts`).
- `ym-samples/`: Original Atari ST music sources.
