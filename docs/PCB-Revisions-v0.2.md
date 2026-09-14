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

## 3. ERR-AUDIO-POP — Scrambled/garbled sound at startup — open, in progress

Even with Bodge #2 in place and clean audio playback, garbled PSG sound persists during startup. `R_RESET`/`C_RESET` (10k pull-up, 10µF to GND on YM pin 23) is not functioning as it did on the breadboard prototype.

**Bench observations:**
- `C_RESET` polarity verified (Pin 1 (+) to YM pin 23, Pin 2 (−) to GND).
- DC voltage on Pin 23 reads ~5V at power-on.
- `C_RESET` removed, swapped, or reversed did not alter the startup glitch symptom.
- Next step: investigate why `R_RESET`/`C_RESET` is not delaying YM startup or why YM is generating audio during console boot (sigrok capture on Pin 23, power-on timing vs 7800 BIOS RSA check, or floating control lines during boot).

---

## 4. ERR-02 — Missing polarity silkscreen on electrolytic caps — open

No `+`/`−` markers on the 10 µF axial electrolytics. Assembly orientation for v0.2:

| Cap           | Value              | Layer  | Pin 1 (+)                               | Pin 2 (−)                              |
| :------------ | :----------------- | :----- | :--------------------------------------- | :--------------------------------------- |
| `C_RESET`     | 10 µF              | Bottom | `RESET_DELAYED` (YM pin 23 / R_RESET)   | GND                                    |
| `C_AUDIO_OUT` | 10 µF              | Bottom | `CAP_PLUS` (from R_SERIES / LM358 OUT1) | `OPAMP_OUT_AC` (Exaudio / cart pin 18) |
| `C_BULK`      | 10 µF _(optional)_ | Bottom | VCC                                     | GND                                    |

- **v0.3 fix:** `pcb/PolarizedCap.tsx` (already in working tree) emits `+`/`−` silkscreen.

---

## 5. ERR-MIRROR — Back-layer silkscreen text not mirrored — fixed

Back-layer reference designators and custom text (e.g. `PolarizedCap`'s `+`/`−` marks) were placed correctly but not mirrored, reading backwards from the bottom.

- **Fix (done):** `pcb/route_and_patch.py` sets KiCad's mirror flag on back-layer text after import. Confirmed via `pcb/build/index-drc.rpt`: all 6 `nonmirrored_text_on_back_layer` warnings gone.

---

## 6. ERR-FIT — Cartridge doesn't fully seat in console — open, not investigated

Cart needs to slide in further. Suspect `U_ROM` needs to move away from the edge connector to clear an interference point, without extending the board outline.

---

## 7. Other working-tree changes

- Removed `C_BULK` (optional 10 µF bulk cap) from `pcb/28pin.circuit.tsx` — board runs fine without it.
- Cart pin 14 relabeled `GND_FRONT` (was sharing the label `"GND"` with pin 30, so never assigned to the net — same root cause as the old ERR-01). Now on `net.GND`; still needs the manual KiCad stitch check in §7 to confirm it reaches copper.

## 8. v0.3 fix list

- [ ] **ERR-OE:** manually verify + stitch ROM `/OE` (and cart pin 14 / `GND_FRONT`) onto the GND zone in KiCad after gerber generation — see §1.
- [x] **ERR-AUDIO-DISTORT:** bridge `SUM_NODE` directly to `C_AUDIO_OUT` pin 2 (`Exaudio`) in PCB routing, restoring Eagle's Active Shunt — resolved via Bodge #2, see §2.
- [ ] **ERR-AUDIO-POP:** investigate and fix startup garbled audio — `R_RESET`/`C_RESET` not suppressing startup glitch as on prototype — see §3.
- [ ] **ERR-02:** `<PolarizedCap>` with `+`/`−` silkscreen (already in working tree).
- [x] **ERR-MIRROR:** back-layer text mirroring — done, see §5.
- [ ] **ERR-FIT:** investigate moving `U_ROM` away from the edge connector so the cart fully seats, without extending the board outline — see §6.
- [ ] Use the `.devcontainer` image for PCB builds going forward (KiCad 9.0, freerouting 2.2.4, galette pinned there).
