# Emulator Support

To iterate rapidly without burning EPROMs, you can use these specialized forks that include full support for the physical YM2149 hardware mapping.

## A78 Header & Emulator Detection

The project uses a **v4 A78 Header** (an extension of the standard 128-byte header) to signal to the emulator that YM2149 hardware is present.

- **Header Version**: `4` (Offset 0)
- **Audio Location**: `$0800` written into Offset 66–67 (`a78tool`'s `audio` field) — the real YM2149 address register location (stored as `$00` at Offset 66 and `$08` at Offset 67).
- **Cart Type Flag**: Bit 2 of the Cart Type low byte (Offset 54) is force-set as a redundant "YM2149 present" flag for emulator detection (`--ym2149`).
- **Mapper** (Offset 64): `0` = Linear (fixed 32KB, no bankswitching). `1` = 32-pin board's YM-IOA bank scheme — fixed 32KB at `$8000-$FFFF` plus a 16KB window at `$4000-$7FFF` bank-selected via the YM2149's IOA port (see [Hardware-32pin.md](Hardware-32pin.md)). `a78tool` sets this from the `mapper` field in its config JSON; for mapper 1 the input binary must be the full 128KB or 256KB ROM image, not just the fixed bank.

When the `a7800`, `js7800`, or `test7800` forks detect YM2149 hardware in a `.a78` file, they automatically enable the YM2149 engine and map it to the **$0800–$0801** range.

## a7800 (Desktop)

A desktop emulator for the 7800, updated here to include support for this YM2149 memory mapping and bank switching.

- **Repository**: [https://github.com/jbsohn/a7800](https://github.com/jbsohn/a7800)
- **Branch**: `ym2149`
- **Key Enhancements**:
  - **Native Apple Silicon Support**: Runs natively on **macOS M1/M2/M3** CPUs.
  - **Hardware Accuracy**: Implements the physical memory mapping ($0800–$0801) used by this project.
  - **AY/YM Engine**: Full emulation of the YM2149 PSG, synchronized with the 7800 PHI2 clock.
  - **32-Pin Bank Switching**: Emulates the Mapper 1 YM-IOA bank scheme ($4000–$7FFF).

## js7800 (Web-based)

A browser-based emulator that allows for zero-setup testing and sharing.

- **Live Demo**: [**Play the YM2149 Demo in your Browser**](https://jbsohn.github.io/js7800-ym-player/)
- **Repository**: [https://github.com/jbsohn/js7800](https://github.com/jbsohn/js7800)
- **Branch**: `ym2149`
- **Key Enhancements**:
  - **WebAudio Integration**: Bridges the 6502 register writes to the browser's audio engine for real-time playback.
  - **Rapid Iteration**: Load your `.a78` builds directly into the browser.
  - **32-Pin Bank Switching**: Emulates the Mapper 1 YM-IOA bank scheme (`CARTRIDGE_TYPE_YM_BANKED` in `Cartridge.js`) — the `$4000-$7FFF` window follows the YM2149's IO Port A whenever register 7 has it configured as an output, including the 128KB chip's bank-number aliasing (no A17 pin) and the power-on pull-up float to the fixed-region mirror.

## test7800 (Desktop, cross-platform)

A Go-based experimental 7800 emulator (6502/TIA/RIOT/ARM core shared with [Gopher2600](https://github.com/JetSetIlly/Gopher2600)) with a built-in command-line debugger, forked to add YM2149 support.

- **Repository**: [https://github.com/jbsohn/test7800](https://github.com/jbsohn/test7800)
- **Branch**: `ym2149`
- **Key Enhancements**:
  - **YM2149 PSG Emulation** (`hardware/ym2149`): mapped to the **$0800–$0801** range.
  - **YM-IOA Banked Cartridge Support** (`hardware/memory/external/ymbanked.go`): implements the 32-pin board's Mapper 1 scheme, auto-detected from the v4 A78 header fingerprint (`hardware/memory/external/fingerprint.go`).
