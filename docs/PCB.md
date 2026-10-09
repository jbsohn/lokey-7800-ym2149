# PCB Design & Automated Routing Pipeline

This document details the code-driven PCB layout, post-routing pipeline, and build system for the Atari 7800 YM2149
sound card cartridge.

---

## PCB Overview

The primary project boards are 2-layer cartridge PCBs designed to fit standard Atari 7800 cartridge shells. Both
cartridges natively accept standard, authentic through-hole DIP-40 sound chips (**YM2149**, **KC89C72**, or
**AY-3-8910**). An **optional** daughterboard module is also provided. Component placements, net connections, and board
outlines are defined using **tscircuit** (React TSX).

- **`pcb/28pin.circuit.tsx` (Primary Cartridge)**: Single YM2149, ATF16V8B PLD, solder-jumper ROM size selection.
  Hardware spec: [Hardware-28pin.md](Hardware-28pin.md).
- **`pcb/32pin.circuit.tsx` (Primary Cartridge)**: Single YM2149, ATF22V10 PLD, native DIP-32 socket with software bank
  switching. Hardware spec: [Hardware-32pin.md](Hardware-32pin.md).
- **`pcb/ym2149.circuit.tsx` (OPTIONAL Daughterboard Carrier)**: ATmega324-based drop-in replacement carrier module
  (40-pin DIP footprint). **This board is strictly optional**; standard cartridges do not require it and run natively
  with authentic DIP-40 PSG chips. Bill of Materials: [BOM-ym2149.md](BOM-ym2149.md).
- **v0.2 Hardware Errata & Revisions**: [PCB-Revisions-v0.2.md](PCB-Revisions-v0.2.md) (known physical board errata and
  planned fixes for v0.3).

---

## Visual Previews

> [!NOTE]
> These previews link to the [latest GitHub Release](https://github.com/jbsohn/lokey-7800-ym2149/releases/latest) build
artifacts, reflecting the most recently tagged `v*` release.
> The **28-Pin** and **32-Pin** boards are the primary cartridge PCBs. The **YM2149 Daughterboard** is an **optional**
drop-in module for the 40-pin sound chip socket.

### 28-Pin Board Previews

|                                                                                                        Front View (Top Copper)                                                                                                        |                                                                                                     Back View (Bottom Copper)                                                                                                      |                                                                                                    3D Render (Isometric)                                                                                                     |
|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| [<img src="https://github.com/jbsohn/lokey-7800-ym2149/releases/latest/download/pcb_front_28pin.png" width="200" alt="28-Pin PCB Front" />](https://github.com/jbsohn/lokey-7800-ym2149/releases/latest/download/pcb_front_28pin.png) | [<img src="https://github.com/jbsohn/lokey-7800-ym2149/releases/latest/download/pcb_back_28pin.png" width="200" alt="28-Pin PCB Back" />](https://github.com/jbsohn/lokey-7800-ym2149/releases/latest/download/pcb_back_28pin.png) | [<img src="https://github.com/jbsohn/lokey-7800-ym2149/releases/latest/download/pcb_3d_28pin.png" width="400" alt="28-Pin PCB 3D" />](https://github.com/jbsohn/lokey-7800-ym2149/releases/latest/download/pcb_3d_28pin.png) |

### 32-Pin Board Previews

|                                                                                                        Front View (Top Copper)                                                                                                        |                                                                                                     Back View (Bottom Copper)                                                                                                      |                                                                                                    3D Render (Isometric)                                                                                                     |
|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| [<img src="https://github.com/jbsohn/lokey-7800-ym2149/releases/latest/download/pcb_front_32pin.png" width="200" alt="32-Pin PCB Front" />](https://github.com/jbsohn/lokey-7800-ym2149/releases/latest/download/pcb_front_32pin.png) | [<img src="https://github.com/jbsohn/lokey-7800-ym2149/releases/latest/download/pcb_back_32pin.png" width="200" alt="32-Pin PCB Back" />](https://github.com/jbsohn/lokey-7800-ym2149/releases/latest/download/pcb_back_32pin.png) | [<img src="https://github.com/jbsohn/lokey-7800-ym2149/releases/latest/download/pcb_3d_32pin.png" width="400" alt="32-Pin PCB 3D" />](https://github.com/jbsohn/lokey-7800-ym2149/releases/latest/download/pcb_3d_32pin.png) |

### YM2149 Daughterboard Previews (Optional)

|                                                                                                         Front View (Top Copper)                                                                                                         |                                                                                                      Back View (Bottom Copper)                                                                                                       |                                                                                                     3D Render (Isometric)                                                                                                      |
|:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| [<img src="https://github.com/jbsohn/lokey-7800-ym2149/releases/latest/download/pcb_front_ym2149.png" width="200" alt="YM2149 PCB Front" />](https://github.com/jbsohn/lokey-7800-ym2149/releases/latest/download/pcb_front_ym2149.png) | [<img src="https://github.com/jbsohn/lokey-7800-ym2149/releases/latest/download/pcb_back_ym2149.png" width="200" alt="YM2149 PCB Back" />](https://github.com/jbsohn/lokey-7800-ym2149/releases/latest/download/pcb_back_ym2149.png) | [<img src="https://github.com/jbsohn/lokey-7800-ym2149/releases/latest/download/pcb_3d_ym2149.png" width="400" alt="YM2149 PCB 3D" />](https://github.com/jbsohn/lokey-7800-ym2149/releases/latest/download/pcb_3d_ym2149.png) |

> [!NOTE]
> The 3D renders show bare copper/silkscreen/drill geometry without component bodies — the `tscircuit`-generated
footprints don't currently have 3D models (STEP/WRL) assigned, so chips, connectors, and passives don't appear as solid
parts yet.

---

## Compilation & Routing Pipeline

The whole flow is TypeScript (`pcb/build-pcb.ts`, run with Bun). KiCad is only used through its stable `kicad-cli` for
zone refill, DRC and Gerber export; there is no Python or `pcbnew` scripting.

```mermaid
graph TD
    A[React Code *.circuit.tsx] -->|tsci build| B[Unrouted circuit JSON]
    B -->|pcb/freerouting - dsn . ts| C[Specctra DSN]
    C -->|Freerouting| D[Routed session]
    D -->|dsn - converter| E[Routed circuit JSON]
    E -->|tsci export| F[KiCad PCB]
    F -->|kicadts fixups| G[Patched KiCad PCB]
    G -->|kicad - cli drc - - format json - - refill - zones| H[DRC gate]
    H -->|kicad - cli export| I[Gerbers, drill, zip]
```

### Pipeline Steps (`pcb/build-pcb.ts`)

1. **Build**: `tsci build` compiles the React TSX into an unrouted circuit JSON.
2. **DSN** (`pcb/freerouting-dsn.ts`): converts the circuit JSON to Specctra DSN with tscircuit's `dsn-converter`, then
   patches what the converter gets wrong:
    - one image per part (the converter reuses one part's pins for every same-size part, so pads end up in the wrong
      place);
    - unique pin ids for pads without a source port, and a one-pin net for every unused pad so it acts as an obstacle;
    - drops the duplicate 2-pin nets that hand-placed `<trace>` elements create;
    - real board outline, GND copper pours as planes, edge-connector clearance rules, and a 0.2mm minimum clearance.
    - **Self-check** (`verifyDsn`): before Freerouting runs, the build verifies every assumption these patches rely on
      (one image per part, unique pin ids, every pad present at the right place, every pin in exactly one net, boundary,
      planes and clearance rules applied). If a `dsn-converter` upgrade changes its output, the build fails with a
      specific message instead of misplacing pads.
3. **Freerouting**: routes every net with the documented CLI (`-de`/`-do`/`--gui.enabled=false`, `-mt 0` to skip the
   optimizer). After the session is written, a second documented `-drc` invocation checks `unconnected_items`; the build
   fails if any remain.
4. **Merge**: routes and vias are merged back into the circuit JSON (all vias are through vias).
5. **Export & fix up**: `tsci export` writes the KiCad board; `kicadts` then raises reference-designator text to at
   least 0.8mm (thickness 0.1mm), sets GND zone `min_thickness` to 0.15mm and the revision (`Rev1`). The `.kicad_pro`
   DRC minimums come from the `<board>` itself (`minTraceWidth`, via and edge clearances), and `.kicad_dru` waives edge
   clearance for connector `J1` and the connector-notch nets.
6. **Zone refill + DRC gate**:
   `kicad-cli pcb drc --format json --severity-error --severity-warning --refill-zones --save-board`. tscircuit exports
   the copper pour before routing, so this refill is required. The gate reads the documented JSON schema
   (`https://schemas.kicad.org/drc.v1.json`) and fails on any short, clearance or track-width violation, or any
   unconnected item other than the known GND zone-fill fragments. It also fails if the report omits the error or warning
   severity, if the `.kicad_pro` ignores a check the gate depends on, or if a violation has no `type` (it cannot be
   classed as cosmetic).
7. **Gerbers**: writes Gerber and drill files to `pcb/build/gerbers/`, sets `Finish: ENIG` and the revision in the job
   file, and zips them to `pcb/build/gerbers.zip` (plus `gerbers-<board>.zip`, `index-<board>.kicad_pcb` and
   `index-<board>-drc.json`).

`make pcb-check` runs steps 1-6 for both boards without writing Gerbers.

---

## Environment Setup & Build Commands

### Setup Options

- **Option A (Docker Dev Container — Recommended):** Open `.devcontainer/` in VS Code. Pre-loaded with KiCad, Java 25,
  Freerouting, Node.js/Bun, `galette`, and `ca65`/`ld65` (the PCB build needs KiCad 10 or newer).
- **Option B (Native Requirements):**
    - **Bun**: runs `tscircuit` and the PCB build script (`bun install` in `pcb/`).
    - **KiCad (v10.0+)**: the `kicad-cli` executable (zone refill needs `pcb drc --refill-zones`, added in KiCad 10).
    - **Java JRE (21+) & Freerouting**: `make freerouting` downloads the pinned 2.4.1 jar into `pcb/.tools/` and
      verifies its SHA-256; the `pcb*` targets do this automatically. To use your own copy, set `FREEROUTING_JAR` to a
      jar (or `FREEROUTING_BIN` to a `freerouting` executable).

### Build Commands

```bash
# 1. Install dependencies
cd pcb && bun install

# 2. Build 28-pin PCB Gerbers
make pcb-28pin

# 3. Build 32-pin PCB Gerbers
make pcb-32pin   # or `make pcb`

# 4. Build YM2149 daughterboard Gerbers
make pcb-ym2149

# 5. Generate schematic SVG/PNG diagrams
make schematic-28pin
make schematic-32pin
make schematic-ym2149

# 6. Generate board SVG/PNG previews and 3D renders
make previews-28pin
make previews-32pin
make previews-ym2149
```
