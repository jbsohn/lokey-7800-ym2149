# Emulator Support

To iterate rapidly without burning EPROMs, you can use these specialized forks that include full support for the physical YM2149 hardware mapping.

## A78 Header & Emulator Detection

The project uses a **v4 A78 Header** (an extension of the standard 128-byte header) to signal to the emulator that YM2149 hardware is present and configure the banking scheme.

- **Header Version**: `4` (Offset 0).
- **Audio Word**: Bit 11 (`0x0800`) written as a 16-bit big-endian word at Offsets 66–67 (stored as `$08` at Offset 66 and `$00` at Offset 67). Emulators check `(audio & 0x0800) != 0` to enable the YM2149 PSG at `$0800–$0801`.
- **Cart Type Word**: Offsets 53–54 are kept as `0x0000` (Normal / Standard ROM cart). In the A78 specification, bit 2 of Offset 54 (`0x0004`) designates SuperGame Extra RAM at `$4000`, so it must remain `0` for YM carts to prevent emulators from wiping the `$4000` ROM region to RAM.
- **Mapper** (Offset 64):
  - `0` = Linear / Flat ROM (fixed 32KB or 48KB, no bankswitching).
  - `1` = 32-pin board's YM-IOA bank scheme — fixed 32KB at `$8000–$FFFF` plus a 16KB window at `$4000–$7FFF` bank-selected via the YM2149's IOA port (see [Hardware-32pin.md](Hardware-32pin.md)).
  - *Heuristic Fallback:* If Offset 64 is `0` but YM audio is enabled and ROM size > 48KB, all forks automatically enable the YM-IOA bank switcher.

When the `a7800`, `js7800`, or `test7800` forks detect YM2149 hardware in a `.a78` file, they automatically enable the YM2149 engine and map it to the **$0800–$0801** range.

## a7800 (Desktop)

A desktop emulator for the 7800, updated here to include support for this YM2149 memory mapping and bank switching.

- **Repository**: [https://github.com/jbsohn/a7800](https://github.com/jbsohn/a7800)
- **Branch**: `ym2149`
- **Key Enhancements**:
  - **Native Apple Silicon Support**: Runs natively on **macOS M1/M2/M3/M4** CPUs.
  - **Hardware Accuracy**: Implements the physical memory mapping ($0800–$0801) used by this project.
  - **AY/YM Engine**: Full emulation of the YM2149 PSG, synchronized with the 7800 PHI2 clock.
  - **32-Pin Bank Switching**: Emulates the Mapper 1 YM-IOA bank scheme ($4000–$7FFF) with 5-bit bank selection (`IOA0–IOA4`, up to 512KB / 32 banks) and power-on pull-up float to the top fixed code bank.

## js7800 (Web-based)

A browser-based emulator that allows for zero-setup testing and sharing.

- **Live Demo**: [**Play the YM2149 Demo in your Browser**](https://jbsohn.github.io/js7800-ym-player/)
- **Repository**: [https://github.com/jbsohn/js7800](https://github.com/jbsohn/js7800)
- **Branch**: `ym2149`
- **Key Enhancements**:
  - **WebAudio Integration**: Bridges the 6502 register writes to the browser's audio engine for real-time playback.
  - **Rapid Iteration**: Load your `.a78` builds directly into the browser via drag & drop.
  - **32-Pin Bank Switching**: Emulates the Mapper 1 YM-IOA bank scheme (`CARTRIDGE_TYPE_YM_BANKED` in `Cartridge.js`) — the `$4000–$7FFF` window follows the YM2149's IO Port A (up to 32 banks / 512KB) whenever Register 7 has IOA configured as an output, including power-on pull-up float to Bank 31 and hardware bank wrapping.

## test7800 (Desktop, cross-platform)

A Go-based experimental 7800 emulator (6502/TIA/RIOT/ARM core shared with [Gopher2600](https://github.com/JetSetIlly/Gopher2600)) with a built-in command-line debugger, forked to add YM2149 support.

- **Repository**: [https://github.com/jbsohn/test7800](https://github.com/jbsohn/test7800)
- **Branch**: `ym2149`
- **Key Enhancements**:
  - **YM2149 PSG Emulation** (`hardware/ym2149`): mapped to the **$0800–$0801** range.
  - **YM-IOA Banked Cartridge Support** (`hardware/memory/external/ymbanked.go`): implements the 32-pin board's Mapper 1 scheme with 5-bit bank latching (`data & 0x1F`), Register 7 bit 6 direction control, and automatic BIOS bypass to prevent RSA signature lockup. Auto-detected from the v4 A78 header fingerprint (`hardware/memory/external/fingerprint.go`).
