# PCB v0.2 — Errata & Revision Notes

The v0.2 28-pin board is a **bring-up / validation prototype**: rework it on the bench to
prove out the design, then roll the confirmed fixes into v0.3 and order a fresh board.

**Current state: fully working, including sound — one bodge wire.**

**Tested configuration: 28-pin board, 32 KB ROM (27C256), JP1/JP2 set accordingly.**
Testing complete on the current physical v0.2 PCB — one bodge wire required (ERR-OE, §1).
16 KB (27C128) and 64 KB (27C512) configurations have not been tested.

---

## 1. ERR-OE — ROM `/OE` (pin 22) not connected to GND _(confirmed, bodged, required)_

By design, `pcb/28pin.circuit.tsx` ties the ROM's `/OE` straight to GND
(`OE: "net.GND"` — see also `docs/Hardware-28pin.md`, `22 | !OE | Output Enable → GND`).
On this physical board that connection never made it to copper: ROM pin 22 had no
continuity to ground. `/OE` floating meant the ROM's data outputs never actually drove the
bus, even though `/CE` was being asserted correctly — so the ROM stayed electrically
silent no matter what the rest of the decode did.

- **v0.2 fix (done, required, board confirmed fully working with it):** bodge wire ROM
  pin 22 → GND (landed on ROM pin 14).

---

## 2. ERR-02 — Missing polarity silkscreen on electrolytic caps

No `+`/`−` markers on the 10 µF axial electrolytics. Assembly orientation for v0.2 boards:

| Cap           | Value              | Layer  | Pin 1 (+)                               | Pin 2 (−)                              |
| :------------ | :----------------- | :----- | :-------------------------------------- | :------------------------------------- |
| `C_RESET`     | 10 µF              | Bottom | `RESET_DELAYED` (YM pin 23 / R_RESET)   | GND                                    |
| `C_AUDIO_OUT` | 10 µF              | Bottom | `CAP_PLUS` (from R_SERIES / LM358 OUT1) | `OPAMP_OUT_AC` (Exaudio / cart pin 18) |
| `C_BULK`      | 10 µF _(optional)_ | Bottom | VCC                                     | GND                                    |

**v0.3:** `pcb/PolarizedCap.tsx` (already in working tree) emits `+`/`−` silkscreen.

---

## 3. ERR-MIRROR — Back-layer silkscreen text not mirrored _(confirmed, fixed)_

Reference designators and custom silkscreen text (e.g. `PolarizedCap`'s `+`/`−` marks) on
bottom-layer parts were placed correctly but not mirrored, so they read backwards when
actually viewed from the bottom of the board. tscircuit exposes no `mirror` prop on
`<silkscreentext>` — mirroring has to be forced via the KiCad Python API after import.

- **Fix (done, verified in the devcontainer build):** `pcb/route_and_patch.py` now walks
  every footprint's reference/value fields and graphical text items and sets KiCad's
  mirror flag on any that are on a back layer and aren't already mirrored. Confirmed via
  `pcb/build/index-drc.rpt`: the `[nonmirrored_text_on_back_layer]` warnings (6 of them)
  are gone after this change. Also passed `layer={props.layer}` through in
  `pcb/PolarizedCap.tsx` so its `+`/`−` text is explicitly tagged with the same layer as
  the capacitor itself.

---

## 4. ERR-FIT — Cartridge doesn't fully seat in console _(open, not investigated)_

The cart needs to slide in slightly further than it does. Suspect `U_ROM` needs to move
further from the edge connector ("up the board") to clear an interference point, without
extending the board outline. Not root-caused yet — just noting it before it's forgotten.

---

## 5. ERR-AUDIO-POP — Scrambled/glitchy audio at power-on _(open, not investigated)_

`R_RESET`/`C_RESET` are meant to hold the YM in reset for ~100 ms after power-up
specifically to avoid this (see `pcb/bom-notes.json`: "~100 ms YM release delay to prevent
warm-start stuck tones"), but startup audio is still scrambled. Suspect could be cap
orientation/wiring on assembly rather than a design issue — unconfirmed, needs bench
investigation (scope the `RESET_DELAYED` node at power-on, verify `C_RESET` polarity per
§2's table).

---

## 6. Other working-tree changes this session

- Removed `C_BULK` (10 µF bulk cap) from `pcb/28pin.circuit.tsx` — already documented as
  optional in `pcb/bom-notes.json`; board runs fine without it.
- Cart pin 14 relabeled `GND_FRONT` (was sharing the literal label `"GND"` with pin 30 in
  `pcb/Atari7800EdgeConnector.tsx`, which meant it never actually got assigned to the net —
  this is the same root cause as the old ERR-01). Now correctly on `net.GND` in the
  netlist; still needs the manual KiCad stitch check above to confirm it reaches copper.

## 7. v0.3 fix list

- [ ] **ERR-OE:** manually verify + stitch ROM `/OE` (and cart pin 14 / `GND_FRONT`) onto
      the GND zone in KiCad after gerber generation — see §1.
- [ ] **ERR-02:** `<PolarizedCap>` with `+`/`−` silkscreen (already in working tree).
- [x] **ERR-MIRROR:** back-layer text mirroring — done, see §3.
- [ ] **ERR-FIT:** investigate moving `U_ROM` further from the edge connector so the cart
      fully seats, without extending the board outline — see §4.
- [ ] **ERR-AUDIO-POP:** investigate startup audio glitch despite the `R_RESET`/`C_RESET`
      delay — see §5.
- [ ] Use the `.devcontainer` image for PCB builds going forward (`FREEROUTING_JAR` and
      the whole toolchain are pinned there — KiCad 9.0, freerouting 2.2.4, galette — rather
      than relying on ad hoc host tools).
