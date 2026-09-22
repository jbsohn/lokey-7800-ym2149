# PCB v0.2 — Errata & Revision Notes

Bring-up/validation prototype (28-pin board). **Current state: fully working, including sound — two bodge wires required.**

Tested: 28-pin board, 32 KB ROM (27C256), JP1/JP2 set accordingly. 16 KB (27C128) and 64 KB (27C512) not tested.

---

## 1. ERR-OE — ROM `/OE` (pin 22) not connected to GND — confirmed, bodged, required

Design ties ROM `/OE` to GND (`pcb/28pin.circuit.tsx`, `OE: "net.GND"`), but on this board pin 22 had no continuity to ground, so the ROM never drove the bus.

- **Fix (done):** bodge wire ROM pin 22 → GND (landed on pin 14). Board confirmed working with this fix.

---

## 2. ERR-AUDIO-DISTORT — Missing bridge from `SUM_NODE` to `C_AUDIO_OUT (-)` / `Exaudio` — confirmed, bodged, fixed

On v0.2, the direct audio path from the YM passive summing node to Cart Pin 18 (`Exaudio`) was missing. `SUM_NODE` was isolated to LM358 Pin 2, and `Exaudio` was connected only to `C_AUDIO_OUT` pin 2, accidentally turning the circuit into an inverting series amplifier with non-inverting input at ground. This caused severe playback distortion as the single-supply op-amp saturated against ground, clipping the audio into harsh square waves ("scrambled, like it's too loud").

- **Fix (done):** bodge wire #2 from `SUM_NODE` (LM358 Pin 2) → `C_AUDIO_OUT` negative lead / Cart Pin 18 (`Exaudio`).
- **Result:** Playback audio is clean, undistorted, and properly balanced. Restores Eagle's "Active Shunt" architecture.

---

## 3. ERR-AUDIO-POP — Scrambled/garbled sound at startup — Fixed (confirmed on hardware, 2026-09-17)

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
- **Fix (installed & confirmed on v0.2 hardware): CD40106/74HC14 Schmitt-trigger reset delay.**
  - Two gates of a CD40106 hex Schmitt-trigger inverter wired as a non-inverting buffer on a simple RC (R=220kΩ VCC→node, C=10µF node→GND) drive Pin 23 directly — no separate pull-up needed, replacing `R_RESET`/`C_RESET` entirely. Full pinout and wiring in `docs/Hardware-28pin.md` §4.
  - **Confirmed on real hardware 2026-09-17:** cartridge boots straight into music after the Atari rainbow with no startup static/garble. Exact hold time not scoped, but the functional result (clean boot) is verified.
  - CD40106 is the part currently in use, confirmed clean on hardware.
- **Rejected approaches (for the record, don't retry without addressing the reason):**
  - **PLD-controlled reset (driving Pin 23 from a spare ATF16V8B pin, e.g. pin 14):** tried and failed. Any PLD equation that watches bus content to decide when to release reset gets spuriously triggered by the same `$0800`/`$1800` aliasing traffic described above — the BIOS RAM-test writes hit essentially every byte pattern (`$00,$FF,$55,$AA,$69,$0F` + Fuji bitmap bytes) at the aliased address, so a bus-content-based release condition reliably fires early. This isn't fixable by tweaking the equation — any bus-watching trigger is fundamentally unreliable during this boot window. A time-based (not bus-based) reset generator is required.
  - **Discrete NPN transistor ground clamp:** designed as a working alternative (Q1 2N3904/2N2222, C1 47µF to VCC, R1 22-33kΩ timing to base, R2 100kΩ bleed to GND, D1 1N4148 discharge diode, still needs `R_RESET` since the transistor only pulls low) — functionally fine, but superseded by the CD40106 approach for better timing consistency across units (digital Schmitt threshold vs. analog Vbe/beta spread) and fewer total parts (3 vs. 6, since the transistor still needs the pull-up).
  - **External binary counter IC (e.g. 74HC4040) driven from the PLD:** would give fully digital/precise timing without relying on bus content, but the ATF16V8B's 8 macrocells can't count the ~2M PHI2 cycles needed for a 1.5-2s delay, so this would require an extra counter chip — bigger package and more BOM than the CD40106 solution for no real benefit.

---

## 4. ERR-02 — Missing polarity silkscreen on electrolytic caps — fixed (v0.3)

No `+`/`−` markers on the 10 µF axial electrolytics on the original v0.2 fab. Assembly orientation for v0.3:

| Cap           | Value              | Layer  | Pin 1 (+)                               | Pin 2 (−)                              |
| :------------ | :----------------- | :----- | :--------------------------------------- | :--------------------------------------- |
| `C_RESET`     | 10 µF              | Bottom | `RC_DELAY` (R_RESET / CD40106 Pin 1)     | GND                                    |
| `C_AUDIO_OUT` | 10 µF              | Bottom | `CAP_PLUS` (from R_SERIES / LM358 OUT1) | `SUM_NODE` (Exaudio / cart pin 18)     |
| `C_BULK`      | 10 µF *(optional)* | Bottom | VCC                                     | GND                                    |

- **v0.3 fix:** `pcb/PolarizedCap.tsx` emits explicit `+`/`−` silkscreen markings and is actively used by `pcb/YmResetAmp.tsx` and the board files.

---

## 5. ERR-MIRROR — Back-layer silkscreen text not mirrored — fixed

Back-layer reference designators and custom text (e.g. `PolarizedCap`'s `+`/`−` marks) were placed correctly but not mirrored, reading backwards from the bottom.

- **Fix (done):** the v0.2 build script set KiCad's mirror flag on back-layer text after import (all 6 `nonmirrored_text_on_back_layer` warnings gone). tscircuit 0.0.2594+ exports back-layer reference designators already mirrored, so the build no longer patches this. The LM358's `{pin1}`-`{pin8}` labels on the non-fabricated `B.Fab` layer still export unmirrored (harmless).

---

## 6. ERR-FIT — Cartridge doesn't fully seat in console — addressed (v0.3)

On v0.2, the cartridge did not slide far enough into the console slot due to the lower IC package sitting too close to the connector throat and cartridge case opening.

- **Fix (done in layout):** Shifted the lower IC stack upwards away from the edge connector without altering the board outline:
  - `U_ROM`: moved up +3.5mm from `pcbY="-21mm"` to `pcbY="-17.5mm"` on 28-pin (and from `-20mm` to `-17.5mm` on 32-pin).
  - `U_GAL`: moved up +1mm from `pcbY="-4mm"` to `pcbY="-3mm"`.
  - `U_LATCH`: moved up +1mm from `pcbY="8mm"` to `pcbY="9mm"`.
- This provides an extra 2.5mm–3.5mm of clearance at the insertion throat; pending final physical test-fit once the v0.3 board is fabricated.

---

## 7. Other working-tree changes

- Removed `C_BULK` (optional 10 µF bulk cap) from `pcb/28pin.circuit.tsx` — board runs fine without it.
- Cart pin 14 (`GND_FRONT`) is intentionally left unconnected. On the v0.2 hardware it never reached ground (it shared the label `"GND"` with pin 30, so it was never assigned to the net), and the board works fully with pin 14 floating and no bodge wire, so it is not needed. Ground comes through cart pin 30.
- `R_YM_AUDIOA/B/C` raised from 1kΩ (unity gain) to 3kΩ in `pcb/28pin.circuit.tsx` and `pcb/32pin.circuit.tsx`, keeping `R_FB` at 1kΩ. Original values were picked ad hoc just to get the channels buffered; at unity gain a full 3-voice chord at max volume could sum to ~3x a single channel's swing into the single-supply LM358, risking clipping near its rails. 3kΩ gives each channel ~1/3 gain so a full chord lands back near a single channel's original headroom. **Not yet bench-tested** — needs a full 3-note max-volume chord check on real hardware before committing.
- Modularized under-socket DIP-40 cavity components into `pcb/YmResetAmp.tsx`, containing the CD40106 Schmitt-trigger reset circuit and LM358 op-amp active shunt stage.

## 8. v0.3 fix list

- [ ] **ERR-OE:** confirm on the v0.3 board that ROM `/OE` (pin 22) has continuity to GND. The build's DRC gate now fails on any pad that is not connected to its net, including a GND pad the zone does not reach (it only tolerates GND zone-to-zone fragments), so a repeat of this fault should stop the build before Gerbers are written. Do not hand-stitch it in KiCad; the board is regenerated on every build — see §1.
- [x] **ERR-AUDIO-DISTORT:** bridge `SUM_NODE` directly to `C_AUDIO_OUT` pin 2 (`Exaudio`) in PCB routing, restoring Eagle's Active Shunt — resolved via Bodge #2, see §2.
- [x] **ERR-AUDIO-POP:** CD40106 Schmitt-trigger reset delay confirmed on hardware — clean boot into music, no startup static. Integrated into source with DIP-14 component (`pcb/CD40106.tsx`) under YM socket cavity in `pcb/YmResetAmp.tsx`; routes cleanly with 0 DRC errors on both 28-pin and 32-pin boards. 74HC14 alternative rejected due to lower threshold ($V_{T+} \approx 2.5\text{V}$) cutting hold time from ~2.0s to ~1.5s and catching BIOS test writes — see §3.
- [x] **ERR-02:** `<PolarizedCap>` with `+`/`−` silkscreen integrated into `pcb/YmResetAmp.tsx` and board files.
- [x] **ERR-MIRROR:** back-layer text mirroring — done, see §5.
- [x] **ERR-FIT:** moved lower IC stack up away from edge connector (`U_ROM` +3.5mm to `-17.5mm`, `U_GAL` to `-3mm`, `U_LATCH` to `9mm`) to clear console insertion depth; pending physical fit check on v0.3 fab — see §6.
- [ ] Use the `.devcontainer` image for PCB builds going forward (KiCad 9.0, freerouting 2.4.1, galette pinned there).
- [ ] **Audio headroom:** bench-verify `R_YM_AUDIOA/B/C` at 3kΩ prevents clipping on a full 3-voice chord at max volume — see §7.
