# Future Ideas & Experimental Enhancements

This document captures long-term project roadmaps, experimental concepts, and hardware expansion ideas for the Lokey 7800 YM project.

---

## YM2149 I/O Port Expansion

The YM2149 PSG includes two 8-bit bidirectional parallel I/O ports (Port A and Port B) with 16 total I/O lines:

- **Port A (`IOA0–IOA3`):** Currently used on the 32-pin board for 16 KB ROM bank switching (physically verified on hardware).
- **Port A (`IOA4–IOA7`):** 4 pins completely free.
- **Port B (`IOB0–IOB7`):** 8 pins completely free.

With **12 spare GPIO pins** available on the chip, future cartridge revisions or developer breakout headers could support:

- **Non-Volatile Save Storage (SPI FRAM / EEPROM):**
  Bit-banging a standard 4-wire SPI bus (`SCK`, `MOSI`, `MISO`, `CS`) using 4 spare I/O pins to read and write persistent game saves, RPG quest progress, or high score tables to an external 32 KB SPI EEPROM (e.g., Microchip 25LC256) or FRAM—with zero batteries required.
- **MIDI Output Port:**
  Using a single I/O pin (plus an inverter and DIN-5 jack) to output standard 31.25 kbaud MIDI data, allowing the Atari 7800 to drive external synthesizers (Roland MT-32, Yamaha DX7, or modern sound modules).
- **Serial Debugging / Telemetry:**
  Bit-banging a 115200-baud UART TX line to stream real-time debugging output and profiling metrics from the 6502 CPU to a modern PC terminal during homebrew development.
- **Cartridge Status / Audio Pulse LEDs:**
  Connecting spare pins through resistors to edge-mounted LEDs that pulse with the music or indicate bank-switching activity.
- **External Controller / Link Cable:**
  Connecting two Atari 7800 consoles together via a 3-wire serial link for head-to-head multiplayer, or interfacing non-standard peripherals.

---

## Hardware Supervisors & Co-Processors

### ATtiny85 Startup Supervisor (The "Chime" Module)

Adding a low-cost ATtiny85 microcontroller to act as a hardware supervisor during boot:

- **Startup Chime:** Plays a signature computation sound or musical jingle immediately at power-on.
- **Decryption Overlay:** Plays sound while the Atari 7800 BIOS is verifying the cartridge signature (which takes ~1.5–2 seconds), giving the user audio feedback that the system is booting.
- **Register Crush:** Performs a hardware-level silent reset of all YM2149 registers before the 6502 code begins execution.

### Independent Audio Co-Processor

Expanding the ATtiny supervisor logic to handle simple sound effects (SFX) or "achievement dings" independently of the main 6502 CPU, offloading basic audio tasks from the game loop.

---

## Physical Form Factor & Output

### Direct 3.5mm Stereo Audio Output Jack

Adding a dedicated 3.5mm stereo jack directly to the top edge of the cartridge shell:

- **High Fidelity:** Bypasses the internal RF modulator and audio mixing path of the Atari 7800 console for crystal-clear output.
- **Stereo Separation:** Allows panning the three PSG channels (e.g., Channel A Left, Channel B Center, Channel C Right) into a true stereo soundfield.
