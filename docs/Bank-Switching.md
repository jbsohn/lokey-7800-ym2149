# 32-Pin Board Bank Switching Specification

Technical reference and software protocol for bank-switched ROM on the 32-pin board (`pcb/32pin.circuit.tsx`).

---

## Memory Map

| 6502 Address | Window Size | Role | Description |
| :--- | :--- | :--- | :--- |
| **`$8000–$FFFF`** | 32 KB | Fixed Code Bank | Hardwired to top 32 KB of ROM. Always mapped; vectors and core engine live here. |
| **`$4000–$7FFF`** | 16 KB | Switched Window | Mapped to selected 16 KB bank (Banks 0–13) via YM Port A. |
| **`$0800–$0801`** | 2 bytes | YM2149 PSG | `$0800` = Address register, `$0801` = Data register (write-only). |

### Bank Layout (256 KB EPROM / AT27C020)

* **Total ROM capacity:** 256 KB (sixteen 16 KB sectors).
* **Banks 0–13 (224 KB):** 14 selectable data banks swapped through `$4000–$7FFF`.
* **Banks 14 & 15 (32 KB):** Fixed code bank mapped at `$8000–$FFFF`.

```
6502 Address Space               Physical 256KB ROM (AT27C020)
+------------------+ $FFFF       +-----------------------------+ $3FFFF
|   Fixed 32KB     |             | Bank 15 (16KB) - Fixed Upper|
|   Code & Vectors | ----------> +-----------------------------+ $3C000
|   ($8000-$FFFF)  |             | Bank 14 (16KB) - Fixed Lower|
+------------------+ $8000       +=============================+ $38000
|  Switched 16KB   |             | Bank 13 (16KB)              |
|   Data Window    | ---------\  +-----------------------------+
|   ($4000-$7FFF)  |           \ | ...                         |
+------------------+ $4000      >+-----------------------------+
| Internal Systems |           / | Bank  1 (16KB)              |
| (RAM, TIA, Maria)|          /  +-----------------------------+ $07FFF
+------------------+ $0000       | Bank  0 (16KB)              |
                                 +-----------------------------+ $00000
```

---

## Software Protocol

Bank switching uses two writes to the YM2149 registers at `$0800` / `$0801`.

### Step 1: Enable Port A Output (Register 7)

Bit 6 of Register 7 sets Port A direction (`1 = output`). Preserve bits 0–5 (tone/noise enables):

```ca65
    lda #AY_MIXER                    ; Register 7
    sta AY_ADDR                      ; $0800
    lda #(AY_IOA_OUTPUT | %00111000) ; Bit 6 = 1 (Port A Output); bits 0-5 = audio enables
    sta AY_DATA                      ; $0801
```

> [!WARNING]
> Any routine updating Register 7 (Mixer) must keep Bit 6 high (`AY_IOA_OUTPUT = %01000000`). Clearing Bit 6 reverts Port A to input mode, resetting the `$4000–$7FFF` window to Bank 15 via the pull-ups.

### Step 2: Select Bank Number (Register 14)

Write the target 16 KB bank number ($0..13$) to Register 14 (Port A data):

```ca65
    lda #AY_IO_A                ; Register 14
    sta AY_ADDR                 ; $0800
    lda #target_bank            ; 0 to 13
    sta AY_DATA                 ; $0801

    ; Data at $4000-$7FFF is now target_bank
```

---

## Hardware Architecture

* **Bank Latch:** YM2149 Port A pins `IOA0–IOA4` store the 5-bit bank index.
* **Address Multiplexer:** ATF22V10 PLD (`U_GAL`) generates ROM upper address lines `ROMA14–ROMA18`.
* **Power-On Reset:** At reset, YM Port A defaults to input (Hi-Z). Five 10 kΩ pull-up resistors (`R_BANK0–R_BANK4`) pull `IOA0–IOA4` high, defaulting `$4000–$7FFF` to Bank 31 (a mirror of the fixed region) for safe boot.

### PLD Equations (`pld/rom_ym_32pin.pld`)

```cupl
BDIR = /A15 * /A14 * /A13 * /A12 * A11 * /RW * HALT * PHI2
BC1  = /A15 * /A14 * /A13 * /A12 * A11 * /RW * /A0 * HALT * PHI2

/ROMCE  = A15 * RW  +  /A15 * A14 * RW
ROMA14  = A15 * A14 +  /A15 * IOA0
ROMA15  = A15 + IOA1
ROMA16  = A15 + IOA2
ROMA17  = A15 + IOA3
ROMA18  = A15 + IOA4
```

* **When `A15 = 1` (`$8000–$FFFF`):** `ROMA15–ROMA18` are forced high; `ROMA14` follows console `A14`. The fixed bank is locked to Banks 30 & 31 (the top 32KB of ROM).
* **When `A15 = 0` and `A14 = 1` (`$4000–$7FFF`):** `ROMA14–ROMA18` directly follow `IOA0–IOA4`, selecting Banks 0–29.

---

## Hardware Capacity Reference

The 5 bank lines (`IOA0–IOA4`) address up to 32 banks of 16 KB each (512 KB total):

| EPROM / Flash Part | Total ROM | Switched Window ($4000–$7FFF) | Fixed Code ($8000–$FFFF) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **AT27C010 / SST39SF010** | 128 KB | Banks 0–5 (6 × 16 KB = 96 KB) | Banks 6 & 7 (32 KB) | `IOA3–IOA4` unused |
| **AT27C020 / SST39SF020** | 256 KB | Banks 0–13 (14 × 16 KB = 224 KB) | Banks 14 & 15 (32 KB) | `IOA4` unused |
| **AT27C040 / SST39SF040** | **512 KB** | **Banks 0–29 (30 × 16 KB = 480 KB)** | **Banks 30 & 31 (32 KB)** | **Full maximum capacity** (DIP JP_A18=512K; PLCC auto) |

### Dual-Footprint & Jumper Configuration (512 KB)

- **PLCC-32 Socket (`U_ROM_PLCC`)**: For `SST39SF` Flash. Pin 1 is hardwired to `ROMA18`, Pin 31 is tied to $V_{CC}$ (`WE#` disable). Auto-detects 128KB, 256KB, and 512KB Flash with zero jumpers!
* **DIP-32 Socket (`U_ROM`)**: Solder jumper `JP_A18` selects Pin 31:
  * Bridge 1–2 ($V_{CC}$): 128KB/256KB UV EPROMs (`27C010`/`27C020`) and 256KB fallback for `27C040`.
  * Bridge 2–3 (`ROMA18`): Full 512KB UV EPROM (`27C040`).
