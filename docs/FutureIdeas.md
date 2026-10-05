# Future Ideas & Experimental Enhancements

This document captures long-term project roadmaps, experimental concepts, and hardware expansion ideas for the Lokey 7800 YM2149 project.

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

---

## Dual DIP-32 / PLCC-32 Nested ROM Footprint

To ensure 100% long-term component availability from primary authorized distributors (DigiKey, Mouser) without sacrificing through-hole hand assembly:

- **Component Supply:** Through-hole DIP-32 Flash memory (`SST39SF010A` / `020A` / `040` in `-PHE` package) has been discontinued by Microchip and is primarily available through retro suppliers. However, the exact same Flash silicon in the **through-hole compatible PLCC-32 package (`-NHE`) remains in active production** and in stock for ~$1.80.
- **Nested Footprint Design:** A dual footprint on the 32-pin board nesting an inner through-hole PLCC-32 socket inside the outer 600-mil DIP-32 footprint.
- **1:1 JEDEC Pin Equivalence:** JEDEC standard 32-pin memory shares identical pin numbering between DIP-32 and PLCC-32 (Pin 1 = NC/A18, Pin 16 = GND, Pin 22 = `/CE`, Pin 24 = `/OE`, Pin 31 = `WE#`, Pin 32 = VCC). Every board trace connects DIP Pin *N* directly to PLCC Pin *N*.
- **Builder Choice:**
  - Populate the outer DIP-32 socket for classic UV EPROMs (e.g., ST M27C2001) or bench ZIF testing.
  - Populate the inner through-hole PLCC-32 socket for brand-new, active-production Flash (`SST39SF020A-70-4C-NHE`).
- **Cartridge Clearance:** A PLCC-32 through-hole socket is ~18 mm × 18 mm (less than half the length of a 42 mm DIP-32), significantly increasing clearance at the cartridge insertion throat.

---

## v0.4 Toolchain & Architecture Roadmap

### State of the Art (v0.3 Release)

The v0.3 release achieves a fully automated, headless **code-to-Gerber CI/CD pipeline** in GitHub Actions. With zero human GUI interaction, a `git push` compiles React JSX, computes 2-layer routing via Freerouting, runs KiCad DRC gates, validates Gerbers against physical edge clearances, and attaches release zips.

### Limitations of the Current Pipeline ("The Hacky Middle")

While the developer experience of writing TypeScript/React hardware components is unmatched, the translation boundary between **tscircuit's internal model** and **KiCad's manufacturing engine** currently relies on brittle AST patching:

1. **Format Ping-Pong:**
   `React JSX` $\rightarrow$ `circuit JSON` $\rightarrow$ `Specctra DSN` $\rightarrow$ `Freerouting CLI` $\rightarrow$ `circuit JSON` $\rightarrow$ `KiCad PCB` $\rightarrow$ AST patch (`kicadts`) $\rightarrow$ `kicad-cli` $\rightarrow$ Gerber zip $\rightarrow$ TypeScript verification script.
2. **Missing Component Props in tscircuit:**
   Standard high-level components (`<resistor>`, `<chip>`) lack fine-grained layout props (e.g. `hideDesignator`, `labelOffset`, `minGroundFillThickness`). Default values are baked in, forcing post-export patching.
3. **Regex/AST File Patching:**
   [pcb/build-pcb.ts](file:///Users/john/Projects/lokey-7800-ym2149/pcb/build-pcb.ts) must inspect KiCad S-expressions as raw text to bump reference designator font sizes, enforce minimum ground zone thickness, and inject custom design rules.
4. **Layout Fragility:**
   Placing physical millimeter coordinates directly in code (`pcbX`, `pcbY`) without visual feedback can inadvertently cause auto-router collisions (e.g., pulling an axial resistor into a keepout zone or triggering text shifts).

### v0.4 Target Architecture: Native C++ Post-Processor (`kicad-cart-tool`)

For v0.4, replace the fragile `kicadts` text-patching layer with a dedicated, lightweight C++ CLI utility that links directly against KiCad's core libraries:

```mermaid
flowchart LR
    JSX[tscircuit React Code\nSchematic & Placement] --> DSN[Specctra DSN]
    DSN --> FR[Freerouting Java CLI]
    FR --> PCB[Exported .kicad_pcb]
    PCB --> CPP[Native C++ CLI\nkicad-cart-tool]
    CPP --> KICAD[kicad-cli DRC]
    KICAD --> GBR[Production Gerbers]
```

#### Why Native C++ Over Python / SWIG

- **SWIG Deprecation:** KiCad's legacy SWIG Python wrappers (`pcbnew`) are formally deprecated by the KiCad core team due to cross-platform maintenance friction and fragility.
- **Zero Runtime Dependencies:** A standalone C++ binary built via CMake requires no Python virtual environments, no SWIG runtime, and no Node.js/npm dependencies.
- **Direct Engine Access:** Interacts directly with KiCad's real C++ data models (`BOARD`, `FOOTPRINT`, `PCB_FIELD`, `ZONE_FILLER`, `IO_MGR`).
- **Sub-10ms Performance:** Loads, mutates, refills zones, and saves the board in milliseconds.
- **Deep Visibility:** Allows stepping through KiCad's exact polygon math, zone clipping, and DRC logic in `lldb`.

#### Core Responsibilities of `kicad-cart-tool`

- **Clean Silkscreen & Text Control:** Hides specific component references programmatically (e.g., `fp->Reference().SetVisible(false)` for `R_BANK0..4`) without shifting geometry.
- **Fab Design Rule Enforcement:** Enforces minimum text height, width, and thickness directly on footprint properties using native setters (`SetTextSize`, `SetTextThickness`).
- **Official Zone Refilling:** Executes KiCad's real C++ polygon engine (`ZONE_FILLER(board.get()).Fill(board->Zones())`) directly, eliminating the need to trigger zone refills via headless DRC side-effects.
- **Guaranteed Syntax Fidelity:** Reading and writing through `IO_MGR::PluginFind(IO_MGR::PCB_FILE_T::KICAD_SEXP)` guarantees 100% schema-compliant output with zero text/parser drift.
