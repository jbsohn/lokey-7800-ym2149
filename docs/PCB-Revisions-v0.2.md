# PCB v0.2 — Errata & Revision Notes

Bring-up/validation prototype (28-pin board). **Current state: fully working, including sound — one bodge wire required.**

Tested: 28-pin board, 32 KB ROM (27C256), JP1/JP2 set accordingly. 16 KB (27C128) and 64 KB (27C512) not tested.

---

## 1. ERR-OE — ROM `/OE` (pin 22) not connected to GND — confirmed, bodged, required

Design ties ROM `/OE` to GND (`pcb/28pin.circuit.tsx`, `OE: "net.GND"`), but on this board pin 22 had no continuity to ground, so the ROM never drove the bus.

- **Fix (done):** bodge wire ROM pin 22 → GND (landed on pin 14). Board confirmed working with this fix.

---

## 2. ERR-02 — Missing polarity silkscreen on electrolytic caps — open

No `+`/`−` markers on the 10 µF axial electrolytics. Assembly orientation for v0.2:

| Cap           | Value              | Layer  | Pin 1 (+)                               | Pin 2 (−)                              |
| :------------ | :----------------- | :----- | :--------------------------------------- | :--------------------------------------- |
| `C_RESET`     | 10 µF              | Bottom | `RESET_DELAYED` (YM pin 23 / R_RESET)   | GND                                    |
| `C_AUDIO_OUT` | 10 µF              | Bottom | `CAP_PLUS` (from R_SERIES / LM358 OUT1) | `OPAMP_OUT_AC` (Exaudio / cart pin 18) |
| `C_BULK`      | 10 µF _(optional)_ | Bottom | VCC                                     | GND                                    |

- **v0.3 fix:** `pcb/PolarizedCap.tsx` (already in working tree) emits `+`/`−` silkscreen.

---

## 3. ERR-MIRROR — Back-layer silkscreen text not mirrored — fixed

Back-layer reference designators and custom text (e.g. `PolarizedCap`'s `+`/`−` marks) were placed correctly but not mirrored, reading backwards from the bottom.

- **Fix (done):** `pcb/route_and_patch.py` sets KiCad's mirror flag on back-layer text after import. Confirmed via `pcb/build/index-drc.rpt`: all 6 `nonmirrored_text_on_back_layer` warnings gone.

---

## 4. ERR-FIT — Cartridge doesn't fully seat in console — open, not investigated

Cart needs to slide in further. Suspect `U_ROM` needs to move away from the edge connector to clear an interference point, without extending the board outline.

---

## 5. ERR-AUDIO-POP — Scrambled/glitchy audio at power-on — open, in progress

`R_RESET`/`C_RESET` hold the YM in reset for ~100 ms after power-up to prevent this, but startup audio is still scrambled.

**Ruled out (bench-confirmed, none changed the symptom):**
- `C_RESET` polarity reversed
- `C_RESET` removed entirely
- `C_RESET` swapped for a fresh part
- `R_RESET` value (10k, correct) and both solder joints
- Wiring topology vs. schematic
- YM pin 24 (`!A9`) — found and fixed a cold joint here; didn't change the symptom

**Next step:** sigrok logic-analyzer capture on `RESET_DELAYED`/YM pin 23 through a power cycle, to see whether `/RESET` holds low and releases cleanly (~70–100 ms) or is misbehaving electrically.

---

## 6. ERR-AUDIO-DISTORT — Distorted audio during playback — open, not investigated

Audio is distorted beyond the power-on glitch in §5. Suspect the amp stage (`U_AMP` / LM358) and/or the reset network — needs investigation alongside ERR-AUDIO-POP.

---

## 7. Other working-tree changes

- Removed `C_BULK` (optional 10 µF bulk cap) from `pcb/28pin.circuit.tsx` — board runs fine without it.
- Cart pin 14 relabeled `GND_FRONT` (was sharing the label `"GND"` with pin 30, so never assigned to the net — same root cause as the old ERR-01). Now on `net.GND`; still needs the manual KiCad stitch check in §7 to confirm it reaches copper.

## 8. v0.3 fix list

- [ ] **ERR-OE:** manually verify + stitch ROM `/OE` (and cart pin 14 / `GND_FRONT`) onto the GND zone in KiCad after gerber generation — see §1.
- [ ] **ERR-02:** `<PolarizedCap>` with `+`/`−` silkscreen (already in working tree).
- [x] **ERR-MIRROR:** back-layer text mirroring — done, see §3.
- [ ] **ERR-FIT:** investigate moving `U_ROM` away from the edge connector so the cart fully seats, without extending the board outline — see §4.
- [ ] **ERR-AUDIO-POP:** investigate startup audio glitch — reset network ruled out, next step is a live sigrok capture — see §5.
- [ ] **ERR-AUDIO-DISTORT:** investigate distorted playback audio — check amp stage and reset network — see §6.
- [ ] Use the `.devcontainer` image for PCB builds going forward (KiCad 9.0, freerouting 2.2.4, galette pinned there).
