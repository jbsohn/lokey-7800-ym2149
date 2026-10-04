; ============================================================
; bank.s -- 32-pin board YM-IOA bank select test (ca65):
; A chromatic scale, one note per bank, across all 32 banks
; of a 512KB ROM (Banks 0..29 switched, Banks 30..31 fixed/mirrored).
;
; Memory Map (512KB ROM, AT27C040 / SST39SF040):
;   $4000-$7FFF (16KB): Banked window selected via YM Port A (IOA0-IOA4)
;                       Banks 0..29 (switched data)
;                       Banks 30..31 (mirror of fixed code region)
;   $8000-$BFFF (16KB): Fixed Bank 30
;   $C000-$FFFF (16KB): Fixed Bank 31 (Vectors at $FFFA-$FFFF)
; ============================================================

.include "maria.inc"
.include "ym2149.inc"

NUM_NOTES        = 32          ; 32 semitones: C3 (Bank 0) -> G5 (Bank 31)
NOTE_HOLD_FRAMES = 30          ; ~0.5s per note at 60Hz NTSC (16s full cycle)

.zeropage
bank_num: .res 1

; --- Bank Data Segments (Banks 0..31) ---
; Each bank stores a 2-byte tone period (fine, coarse) at its base ($4000):
; Period TP = round(f_YM / (16 * f_note)), with f_YM = 1.7897725 MHz (PHI2).
.macro NOTE_BANK segname, fine, coarse
.segment segname
    .byte fine, coarse
.endmacro

; Lower 256KB (IOA4 = 0): Banks 0..15
NOTE_BANK "BANK0",  $57, $03      ; bank  0: C3  (130.8 Hz, TP=$0357)
NOTE_BANK "BANK1",  $27, $03      ; bank  1: C#3 (138.6 Hz, TP=$0327)
NOTE_BANK "BANK2",  $FA, $02      ; bank  2: D3  (146.8 Hz, TP=$02FA)
NOTE_BANK "BANK3",  $CF, $02      ; bank  3: D#3 (155.6 Hz, TP=$02CF)
NOTE_BANK "BANK4",  $A7, $02      ; bank  4: E3  (164.7 Hz, TP=$02A7)
NOTE_BANK "BANK5",  $81, $02      ; bank  5: F3  (174.5 Hz, TP=$0281)
NOTE_BANK "BANK6",  $5D, $02      ; bank  6: F#3 (184.9 Hz, TP=$025D)
NOTE_BANK "BANK7",  $3B, $02      ; bank  7: G3  (195.9 Hz, TP=$023B)
NOTE_BANK "BANK8",  $1B, $02      ; bank  8: G#3 (207.5 Hz, TP=$021B)
NOTE_BANK "BANK9",  $FC, $01      ; bank  9: A3  (220.2 Hz, TP=$01FC)
NOTE_BANK "BANK10", $E0, $01      ; bank 10: A#3 (233.0 Hz, TP=$01E0)
NOTE_BANK "BANK11", $C5, $01      ; bank 11: B3  (246.9 Hz, TP=$01C5)
NOTE_BANK "BANK12", $AC, $01      ; bank 12: C4  (261.4 Hz, TP=$01AC)
NOTE_BANK "BANK13", $94, $01      ; bank 13: C#4 (276.9 Hz, TP=$0194)
NOTE_BANK "BANK14", $7D, $01      ; bank 14: D4  (293.6 Hz, TP=$017D)
NOTE_BANK "BANK15", $68, $01      ; bank 15: D#4 (310.7 Hz, TP=$0168)

; Upper 256KB (IOA4 = 1): Banks 16..31
NOTE_BANK "BANK16", $53, $01      ; bank 16: E4  (330.0 Hz, TP=$0153)
NOTE_BANK "BANK17", $40, $01      ; bank 17: F4  (349.6 Hz, TP=$0140)
NOTE_BANK "BANK18", $2E, $01      ; bank 18: F#4 (370.4 Hz, TP=$012E)
NOTE_BANK "BANK19", $1D, $01      ; bank 19: G4  (392.5 Hz, TP=$011D)
NOTE_BANK "BANK20", $0D, $01      ; bank 20: G#4 (415.8 Hz, TP=$010D)
NOTE_BANK "BANK21", $FE, $00      ; bank 21: A4  (440.4 Hz, TP=$00FE)
NOTE_BANK "BANK22", $F0, $00      ; bank 22: A#4 (466.1 Hz, TP=$00F0)
NOTE_BANK "BANK23", $E2, $00      ; bank 23: B4  (495.0 Hz, TP=$00E2)
NOTE_BANK "BANK24", $D6, $00      ; bank 24: C5  (522.7 Hz, TP=$00D6)
NOTE_BANK "BANK25", $CA, $00      ; bank 25: C#5 (553.8 Hz, TP=$00CA)
NOTE_BANK "BANK26", $BE, $00      ; bank 26: D5  (588.7 Hz, TP=$00BE)
NOTE_BANK "BANK27", $B4, $00      ; bank 27: D#5 (621.4 Hz, TP=$00B4)
NOTE_BANK "BANK28", $AA, $00      ; bank 28: E5  (658.0 Hz, TP=$00AA)
NOTE_BANK "BANK29", $A0, $00      ; bank 29: F5  (699.1 Hz, TP=$00A0)
NOTE_BANK "BANK30", $97, $00      ; bank 30: F#5 (740.8 Hz, TP=$0097, fixed lower $8000)
NOTE_BANK "BANK31", $8F, $00      ; bank 31: G5  (782.2 Hz, TP=$008F, fixed upper $C000)

.segment "CODE"

.export reset
reset:
        sei
        cld
        ldx #$FF
        txs

        ; Clear all 14 audio registers (0..13)
        ldx #NUM_REGS-1
init_loop:
        stx AY_ADDR
        lda #0
        sta AY_DATA
        dex
        bpl init_loop

        ; Enable Port A as output (bit 6 = 1) and enable Tone A (bit 0 = 0)
        lda #AY_MIXER
        sta AY_ADDR
        lda #(AY_IOA_OUTPUT | %00111110)
        sta AY_DATA

        ; Set Channel A volume to maximum (15)
        lda #8
        sta AY_ADDR
        lda #15
        sta AY_DATA

        lda #0
        sta bank_num

note_loop:
        ; Switch 16KB bank at $4000-$7FFF by writing bank index (0..31) to YM Port A
        lda #AY_IO_A
        sta AY_ADDR
        lda bank_num
        sta AY_DATA

        ; Read fine tune period from byte 0 of selected bank ($4000)
        lda #0
        sta AY_ADDR
        lda $4000
        sta AY_DATA

        ; Read coarse tune period from byte 1 of selected bank ($4001)
        lda #1
        sta AY_ADDR
        lda $4001
        sta AY_DATA

        ; Visual feedback: change background color based on bank_num.
        ; Lower 16 banks (IOA4=0): dark/mid tones (luminance 0).
        ; Upper 16 banks (IOA4=1): bright tones (luminance 8) to verify ROMA18 line.
        lda bank_num
        asl
        asl
        asl
        asl
        ldx bank_num
        cpx #16
        bcc :+
        ora #$08
:       sta BKGRND

        ldy #NOTE_HOLD_FRAMES
hold_loop:
        jsr sync_vbi
        dey
        bne hold_loop

        inc bank_num
        lda bank_num
        cmp #NUM_NOTES
        bcc note_loop
        lda #0
        sta bank_num
        jmp note_loop

sync_vbi:
v1:     bit MSTAT
        bmi v1
v2:     bit MSTAT
        bpl v2
        rts

.segment "FOOTER"
        .byte $FF, $83

.segment "VECTORS"
        .word reset
        .word reset
        .word reset
