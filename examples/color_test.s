; ============================================================
; color_test.s -- Simple 32KB Fixed Bring-Up ROM (No Banking)
; Cycles bright background colors and plays a simple YM arpeggio.
; Footer $FFF9 = $87 forces the Atari rainbow boot screen on.
; ============================================================

.include "maria.inc"
.include "ym2149.inc"

.segment "CODE"

.export reset
reset:
        sei
        cld
        ldx #$FF
        txs

        ; Configure YM Channel A Tone and Volume
        lda #AY_MIXER
        sta AY_ADDR
        lda #%00111110          ; Tone on Channel A enabled
        sta AY_DATA

        lda #8                  ; Channel A Volume
        sta AY_ADDR
        lda #15                 ; Maximum volume
        sta AY_DATA

main_loop:
        ; Note 1: Gold / Yellow
        lda #0
        sta AY_ADDR
        lda #$56
        sta AY_DATA
        lda #1
        sta AY_ADDR
        lda #$03
        sta AY_DATA
        lda #$1A                ; Bright Gold
        sta BKGRND
        jsr delay

        ; Note 2: Red
        lda #0
        sta AY_ADDR
        lda #$A6
        sta AY_DATA
        lda #1
        sta AY_ADDR
        lda #$02
        sta AY_DATA
        lda #$4A                ; Bright Red
        sta BKGRND
        jsr delay

        ; Note 3: Blue
        lda #0
        sta AY_ADDR
        lda #$3B
        sta AY_DATA
        lda #1
        sta AY_ADDR
        lda #$02
        sta AY_DATA
        lda #$BA                ; Bright Blue
        sta BKGRND
        jsr delay

        ; Note 4: Green
        lda #0
        sta AY_ADDR
        lda #$CD
        sta AY_DATA
        lda #1
        sta AY_ADDR
        lda #$01
        sta AY_DATA
        lda #$DA                ; Bright Green
        sta BKGRND
        jsr delay

        jmp main_loop

; Pure CPU delay loop (~0.5s at 1.79 MHz)
delay:
        lda #$06
delay_a:
        ldy #$00
delay_y:
        ldx #$00
delay_x:
        dex
        bne delay_x
        dey
        bne delay_y
        sec
        sbc #$01
        bne delay_a
        rts

.segment "FOOTER"
        .byte $FF, $87          ; $87 = Rainbow boot logo ENABLED!

.segment "VECTORS"
        .word reset
        .word reset
        .word reset
