# PCB v0.2 — Errata & Revision Notes

Bring-up/validation prototypes (28-pin and 32-pin boards). **Current state: both boards fully working on real hardware, including sound and bank switching.**

- **Tested (28-pin):** 32 KB ROM (27C256), JP1/JP2 set accordingly. 16 KB (27C128) and 64 KB (27C512) not tested. Two bodge wires required on v0.2 (`ERR-OE` and `ERR-AUDIO-DISTORT`).
- **Tested (32-pin):** 256 KB banked ROM (ST M27C2001), ATF22V10 PLD, 74HCT373 latch, YM2149 PSG. Full 14-note bank switching and audio verified on hardware (2026-09-23). Two bodge wires required on v0.2 (identical to 28-pin: #1 ROM `/OE` ground, and #2 Audio Out `SUM_NODE` to `Exaudio`).

---

## ERR-OE — ROM `/OE` not connected to GND — confirmed, bodged, required

By design, both boards tie the ROM's `/OE` straight to GND (`OE: "net.GND"` in `pcb/28pin.circuit.tsx` and `pcb/32pin.circuit.tsx`). On manufactured v0.2 physical boards, the `/OE` pin was stranded from the ground copper pour during routing, leaving `/OE` floating:

- **28-pin board (`U_ROM` DIP-28):** ROM pin 22 (`/OE`) had no continuity to ground.
  - **Fix (done):** bodge wire ROM pin 22 → GND (landed on pin 14). Board confirmed working.
- **32-pin board (`U_ROM` DIP-32):** ROM pin 24 (`/OE`) had no continuity to ground.
  - **Fix (done):** bodge wire ROM pin 24 → GND (landed on pin 16 or GND plane). Board confirmed booting and bank-switching with this fix. Without it, the ROM stays electrically Hi-Z and the console black-screens.
- **v0.3 fix:** `OE` is tied to `net.GND` in source; KiCad DRC gate now validates zone continuity and halts the build if pin 22/24 is stranded from copper (verified clean with 0 unconnected items on both boards).

---

## ERR-AUDIO-DISTORT — Missing bridge from `SUM_NODE` to `C_AUDIO_OUT (-)` / `Exaudio` — confirmed, bodged, fixed

On both v0.2 boards (28-pin and 32-pin), the direct audio path from the YM passive summing node to Cart Pin 18 (`Exaudio`) was missing. `SUM_NODE` was isolated to LM358 Pin 2, and `Exaudio` was connected only to `C_AUDIO_OUT` pin 2, accidentally turning the circuit into an inverting series amplifier with non-inverting input at ground. This caused severe playback distortion as the single-supply op-amp saturated against ground, clipping the audio into harsh square waves ("scrambled, like it's too loud").

- **Fix (done on both boards):** bodge wire #2 from `SUM_NODE` (LM358 Pin 2) → `C_AUDIO_OUT` negative lead / Cart Pin 18 (`Exaudio`).
- **Result:** Playback audio is clean, undistorted, and properly balanced. Restores Eagle's "Active Shunt" architecture.

---

## ERR-AUDIO-POP — Scrambled/garbled sound at startup — Fixed (confirmed on hardware, 2026-09-17)

### TL;DR Summary

- **Symptom:** Uninitialized garbled/buzzing sound at power-on before game music starts.

- **Hard Ground Test (Bench Confirmed):** Tying YM Pin 23 (`/RESET`) directly to GND with a wire during boot produces **100% DEAD SILENCE**, cleanly playing music once released after game boot.
- **The Root Cause ($4000 vs $0800 Mapping):**
  - **Prototype ($4000):** YM was mapped to `$4000` (cartridge ROM space). The 7800 BIOS *never* writes to ROM during boot, so zero rogue writes ever reached the YM. A simple passive RC reset was sufficient.
  - **PCB v0.2 ($0800):** YM was remapped to `$0800` (Pokey@800 standard). During the ~1.5s BIOS boot, console hardware (latch U11) clamps cartridge address lines `A12`,`A14`, and`A15` to **LOW (0)**.
  - **The Aliasing Trap:** The 7800's internal system RAM is at `$1800–$1FFF` (`A12=1, A11=1`). Because `A12` is forced to 0 at the cart port, **every BIOS write to RAM at `$1800–$1FFF` is seen by the cartridge PLD as a write to `$0800–$0FFF`!**
  - During boot, the BIOS runs RAM tests (writing `$00, $FF, $55, $AA, $69, $0F`) and copies Fuji logo graphics to `$1984–$1FFF`. The PLD asserts `BDIR=1` and `YMLE=1`, blasting test patterns and Fuji bitmaps straight into the YM sound registers!
  - Passive RC reset fails because its analog ramp slowly drifts through the CMOS linear region while the BIOS is actively writing.
- **Why `$0800` Must Be Kept:** `$4000–$7FFF` must remain free for cartridge ROM (32KB/48KB and 32-pin banked windows) and compatibility with the community Pokey@800 standard.
- **Fix: CD40106 Schmitt-trigger reset delay buffer.**
  - Two gates of a CD40106 hex Schmitt-trigger inverter wired as a non-inverting buffer on a simple RC (R=220kΩ VCC→node, C=10µF node→GND) drive Pin 23 directly — no separate pull-up needed, replacing `R_RESET`/`C_RESET` entirely. Full pinout and wiring in `docs/Hardware-28pin.md` (Hardware Reset & Audio Stage).
  - **Confirmed on 28-pin hardware (2026-09-17):** cartridge boots straight into music after the Atari rainbow with no startup static/garble.
  - **32-Pin Board Status & Requirement:** The physical v0.2 32-pin prototype was fabricated with the old passive RC reset pads and lacks the CD40106. For initial bench testing, YM Pin 23 was jumpered directly to +5V. The 32-pin board **needs the CD40106 reset circuit added to the PCB layout** (same as the 28-pin board) to silence startup BIOS noise.
  - In source, `pcb/YmResetAmp.tsx` already integrates the CD40106 under the YM cavity for both 28-pin and 32-pin boards for v0.3 fab.
- **Rejected approaches (for the record, don't retry without addressing the reason):**
  - **PLD-controlled reset (driving Pin 23 from a spare ATF16V8B pin, e.g. pin 14):** tried and failed. Any PLD equation that watches bus content to decide when to release reset gets spuriously triggered by the same `$0800`/`$1800` aliasing traffic described above — the BIOS RAM-test writes hit essentially every byte pattern (`$00,$FF,$55,$AA,$69,$0F` + Fuji bitmap bytes) at the aliased address, so a bus-content-based release condition reliably fires early. This isn't fixable by tweaking the equation — any bus-watching trigger is fundamentally unreliable during this boot window. A time-based (not bus-based) reset generator is required.
  - **Discrete NPN transistor ground clamp:** designed as a working alternative (Q1 2N3904/2N2222, C1 47µF to VCC, R1 22-33kΩ timing to base, R2 100kΩ bleed to GND, D1 1N4148 discharge diode, still needs `R_RESET` since the transistor only pulls low) — functionally fine, but superseded by the CD40106 approach for better timing consistency across units (digital Schmitt threshold vs. analog Vbe/beta spread) and fewer total parts (3 vs. 6, since the transistor still needs the pull-up).
  - **External binary counter IC (e.g. 74HC4040) driven from the PLD:** would give fully digital/precise timing without relying on bus content, but the ATF16V8B's 8 macrocells can't count the ~2M PHI2 cycles needed for a 1.5-2s delay, so this would require an extra counter chip — bigger package and more BOM than the CD40106 solution for no real benefit.

---

## ERR-02 — Missing polarity silkscreen on electrolytic caps — fixed (v0.3)

No `+`/`−` markers on the 10 µF axial electrolytics on the original v0.2 fab. Assembly orientation for v0.3:

| Cap           | Value              | Layer  | Pin 1 (+)                               | Pin 2 (−)                              |
| :------------ | :----------------- | :----- | :--------------------------------------- | :--------------------------------------- |
| `C_RESET`     | 10 µF              | Bottom | `RC_DELAY` (R_RESET / CD40106 Pin 1)     | GND                                    |
| `C_AUDIO_OUT` | 10 µF              | Bottom | `CAP_PLUS` (from R_SERIES / LM358 OUT1) | `SUM_NODE` (Exaudio / cart pin 18)     |
| `C_BULK`      | 10 µF *(optional)* | Bottom | VCC                                     | GND                                    |

- **v0.3 fix:** `pcb/PolarizedCap.tsx` emits explicit `+`/`−` silkscreen markings and is actively used by `pcb/YmResetAmp.tsx` and the board files.

---

## ERR-MIRROR — Back-layer silkscreen text not mirrored — fixed

Back-layer reference designators and custom text (e.g. `PolarizedCap`'s `+`/`−` marks) were placed correctly but not mirrored, reading backwards from the bottom.

- **Fix (done):** the v0.2 build script set KiCad's mirror flag on back-layer text after import (all 6 `nonmirrored_text_on_back_layer` warnings gone). tscircuit 0.0.2594+ exports back-layer reference designators already mirrored, so the build no longer patches this. The LM358's `{pin1}`-`{pin8}` labels on the non-fabricated `B.Fab` layer still export unmirrored (harmless).

---

## ERR-FIT — Cartridge doesn't fully seat in console — addressed (v0.3)

On v0.2, the cartridge did not slide far enough into the console slot due to the lower IC package sitting too close to the connector throat and cartridge case opening.

- **Fix (done in layout):** Shifted the lower IC stack upwards away from the edge connector without altering the board outline:
  - `U_ROM`: moved up +3.5mm from `pcbY="-21mm"` to `pcbY="-17.5mm"` on 28-pin (and from `-20mm` to `-17.5mm` on 32-pin).
  - `U_GAL`: moved up +1mm from `pcbY="-4mm"` to `pcbY="-3mm"`.
  - `U_LATCH`: moved up +1mm from `pcbY="8mm"` to `pcbY="9mm"`.
- This provides an extra 2.5mm–3.5mm of clearance at the insertion throat; pending final physical test-fit once the v0.3 board is fabricated.

---

## Other working-tree changes

- Removed `C_BULK` (optional 10 µF bulk cap) from `pcb/28pin.circuit.tsx` — board runs fine without it.
- Cart pin 14 (`GND_FRONT`) is intentionally left unconnected. On the v0.2 hardware it never reached ground (it shared the label `"GND"` with pin 30, so it was never assigned to the net), and the board works fully with pin 14 floating and no bodge wire, so it is not needed. Ground comes through cart pin 30.
- `R_YM_AUDIOA/B/C` raised from 1kΩ (unity gain) to 3kΩ in `pcb/28pin.circuit.tsx` and `pcb/32pin.circuit.tsx`, keeping `R_FB` at 1kΩ. Original values were picked ad hoc just to get the channels buffered; at unity gain a full 3-voice chord at max volume could sum to ~3x a single channel's swing into the single-supply LM358, risking clipping near its rails. 3kΩ gives each channel ~1/3 gain so a full chord lands back near a single channel's original headroom. Populated and bench-tested clean on 32-pin hardware (2026-09-23); full 3-note max-volume chord headroom stress test pending.
- Modularized under-socket DIP-40 cavity components into `pcb/YmResetAmp.tsx`, containing the CD40106 Schmitt-trigger reset circuit and LM358 op-amp active shunt stage.

## v0.3 fix list

- [x] **ERR-OE:** tied to `net.GND` in source; KiCad DRC gate now validates zone continuity and halts the build if pin 22 (28-pin) or pin 24 (32-pin) is stranded from copper (verified clean with 0 unconnected items on both boards). Multimeter continuity check on physical v0.3 fab remains standard bring-up procedure — see ERR-OE above.
- [x] **ERR-AUDIO-DISTORT:** bridge `SUM_NODE` directly to `C_AUDIO_OUT` pin 2 (`Exaudio`) in PCB routing, restoring Eagle's Active Shunt — resolved via Bodge #2, see ERR-AUDIO-DISTORT above.
- [x] **ERR-AUDIO-POP:** CD40106 Schmitt-trigger reset delay confirmed on 28-pin hardware; integrated into source under YM cavity in `pcb/YmResetAmp.tsx` for both 28-pin and 32-pin boards for v0.3 fab (replaces v0.2 passive RC reset, silences startup BIOS writes). Routes cleanly with 0 DRC errors on both boards — see ERR-AUDIO-POP above.
- [x] **ERR-02:** `<PolarizedCap>` with `+`/`−` silkscreen integrated into `pcb/YmResetAmp.tsx` and board files.
- [x] **ERR-MIRROR:** back-layer text mirroring — done, see ERR-MIRROR above.
- [x] **ERR-FIT:** moved lower IC stack up away from edge connector (`U_ROM` +3.5mm to `-17.5mm`, `U_GAL` to `-3mm`, `U_LATCH` to `9mm`) to clear console insertion depth; pending physical fit check on v0.3 fab — see ERR-FIT above.
- [ ] Use the `.devcontainer` image for PCB builds going forward (KiCad 9.0, freerouting 2.4.1, galette pinned there).
- [ ] **Audio headroom:** bench-verify `R_YM_AUDIOA/B/C` at 3kΩ prevents clipping on a full 3-voice chord at max volume — see Other working-tree changes above.
