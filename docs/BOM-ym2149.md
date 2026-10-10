# Bill of Materials — YM2149 Daughterboard Carrier

Technical specifications & hardware details: [Hardware.md](Hardware.md#optional-ym2149-daughterboard-carrier-pcbym2149circuittsx) and [PCB.md](PCB.md).

Passive ratings are not fixed by the design; recommended defaults:

- **Resistor**: 0603 SMD, 1% thick film, 1/10 W (or 1/16 W)
- **Ceramic**: 0603 SMD ceramic, >= 50 V (C0G/NP0 for 18 pF crystal load; X7R for decoupling and filters)
- **Crystal**: 3225 4-SMD (3.2 mm × 2.5 mm), 27.000 MHz fundamental mode
- **Headers**: Standard 0.100" (2.54 mm) pin pitch

---

## Build Notes & Design Overview

> [!IMPORTANT]
> **Strictly Optional Module:** The primary 28-pin and 32-pin Atari 7800 cartridge boards are designed to accept standard
> through-hole DIP-40 sound chips (**YM2149**, **KC89C72**, or **AY-3-8910**) directly into the `U_YM` socket. You do
> **not** need to build or order this daughterboard for a standard cartridge.

This board (`pcb/ym2149.circuit.tsx`) is a 40-pin DIP form-factor carrier module (19.5 mm × 53.5 mm) powered by an
**ATmega324** microcontroller clocked at **27 MHz**. It acts as a drop-in replacement carrier that plugs directly into
the standard 40-pin DIP `U_YM` socket on either cartridge board:

- **100% 5V Native Operation:** No level shifters needed; directly interfaces with the Atari 7800 5V bus.
- **Single-Cycle Bus Timing:** Full 8-bit bidirectional data bus `DA0–DA7` on MCU `PORTA` (allows single-cycle reads and writes).
- **Bank-Switching Pass-Through:** Full 8-bit general purpose I/O port `IOA0–IOA7` on MCU `PORTC` (supports 32-pin cartridge software bank switching).
- **Analog Output Stage:** 3-channel analog audio (`ANALOG_A`, `ANALOG_B`, `ANALOG_C`) reconstructed from high-speed PWM outputs (`PD5_OC1A`, `PD7_OC2A`, `PD4_OC1B`) through onboard 1st-order RC low-pass filters ($R = 3.6\text{ k}\Omega$, $C = 2.2\text{ nF}$, $f_c \approx 20.1\text{ kHz}$).
- **Firmware:** Based on the open-source [AVR-AY project](https://www.avray.ru/) / [avr-ay-board](https://github.com/Yevgeniy-Olexandrenko/avr-ay-board) by Yevgeniy Olexandrenko.
- **SMT Manufacturing:** All surface-mount components (MCU, crystal, LED, resistors, capacitors) reside on the **Top layer** (`F.Cu`), making it directly compatible with automated SMT assembly (JLCPCB / PCBWay) using the pre-generated [`pcb/bom-ym2149.csv`](../pcb/bom-ym2149.csv) and [`pcb/cpl-ym2149.csv`](../pcb/cpl-ym2149.csv).

---

## Integrated Circuits & Active Silicon

| Ref   | Part           | Package     | Layer | JLCPCB Part # | Function                                                                                                       |
|:------|:---------------|:------------|:------|:--------------|:---------------------------------------------------------------------------------------------------------------|
| U_MCU | ATMEGA324PB-AU | TQFP-44 SMD | top   | C47751        | 8-bit AVR Microcontroller (27 MHz, 32KB Flash). ATmega324PA-AU is also pin- and functionally compatible (LCSC C47751). |
| LED1  | LED (Green)    | 0603 SMD    | top   | C72043 / any  | Power rail indicator LED (turns on when +5V VCC rail is powered). Any standard 0603 LED (Red, Green, or Blue). |

---

## Crystal Oscillator

| Ref | Frequency  | Package                | Layer | JLCPCB / LCSC Part # | Function                                                                              |
|:----|:-----------|:-----------------------|:------|:---------------------|:--------------------------------------------------------------------------------------|
| X1  | 27.000 MHz | 3225 4-SMD (3.2×2.5mm) | top   | C136079              | Fundamental mode crystal oscillator for MCU core clock (HELE X3S027000BA1H-U or equiv) |

---

## Resistors

| Ref | Value | Connections         | Package  | Layer | JLCPCB Part # | Function                                                                           |
|:----|:------|:--------------------|:---------|:------|:--------------|:-----------------------------------------------------------------------------------|
| R1  | 3.6k  | PWM_A / ANALOG_A    | 0603 SMD | top   | C22980        | Audio Channel A PWM reconstruction 1st-order RC low-pass filter ($f_c \approx 20\text{ kHz}$) |
| R2  | 3.6k  | PWM_B / ANALOG_B    | 0603 SMD | top   | C22980        | Audio Channel B PWM reconstruction 1st-order RC low-pass filter ($f_c \approx 20\text{ kHz}$) |
| R3  | 3.6k  | PWM_C / ANALOG_C    | 0603 SMD | top   | C22980        | Audio Channel C PWM reconstruction 1st-order RC low-pass filter ($f_c \approx 20\text{ kHz}$) |
| R4  | 1.4k  | VCC / LED_NODE      | 0603 SMD | top   | C2930049      | Power indicator LED current limiting (~2 mA at 5V; 1k–1.5k interchangeable)       |

---

## Capacitors

| Ref | Value | Type                  | Connections    | Package  | Layer | JLCPCB Part # | Function                                                                           |
|:----|:------|:----------------------|:---------------|:---------|:------|:--------------|:-----------------------------------------------------------------------------------|
| C1  | 18pF  | Ceramic (C0G/NP0, 50V)| XTAL1 / GND    | 0603 SMD | top   | C1647         | Crystal X1 load capacitor                                                         |
| C2  | 100nF | Ceramic (X7R, >=16V)  | VCC / GND      | 0603 SMD | top   | C14663        | U_MCU digital VCC rail decoupling                                                  |
| C3  | 18pF  | Ceramic (C0G/NP0, 50V)| XTAL2 / GND    | 0603 SMD | top   | C1647         | Crystal X1 load capacitor                                                         |
| C4  | 100nF | Ceramic (X7R, >=16V)  | AVCC / GND     | 0603 SMD | top   | C14663        | U_MCU analog AVCC rail decoupling                                                  |
| C5  | 2.2nF | Ceramic (X7R/C0G, 50V)| ANALOG_A / GND | 0603 SMD | top   | C1604         | Audio Channel A PWM reconstruction 1st-order RC low-pass filter ($f_c \approx 20\text{ kHz}$) |
| C6  | 2.2nF | Ceramic (X7R/C0G, 50V)| ANALOG_B / GND | 0603 SMD | top   | C1604         | Audio Channel B PWM reconstruction 1st-order RC low-pass filter ($f_c \approx 20\text{ kHz}$) |
| C7  | 2.2nF | Ceramic (X7R/C0G, 50V)| ANALOG_C / GND | 0603 SMD | top   | C1604         | Audio Channel C PWM reconstruction 1st-order RC low-pass filter ($f_c \approx 20\text{ kHz}$) |

---

## Connectors & Pin Headers

| Ref    | Description                                             | Package / Pitch                  | Layer | Function                                                                              |
|:-------|:--------------------------------------------------------|:---------------------------------|:------|:--------------------------------------------------------------------------------------|
| U_DIP  | 40-Pin DIP Male Plug Header (2× 1×20-pin machined pins) | 0.600" row width, 0.100" pitch   | THT   | Plugs into the `U_YM` 40-pin DIP IC socket on the host 7800 cartridge board          |
| J_ICSP | 2×3 Pin Male Header (standard AVR 6-pin ICSP)           | Dual-row, 0.100" (2.54 mm) pitch | THT   | In-System Programming header for flashing ATmega324 firmware via USBasp / Atmel-ICE   |

### Pin Header Selection Tip (`U_DIP`)

> [!TIP]
> Use **round machined male pin headers** (e.g. Mill-Max 350-10-120-00-006000 or generic round swiss-machined breakaway headers)
> rather than standard square 0.025" post headers. Round machined pins fit smoothly into DIP sockets without expanding or
> degrading the host socket's wipe contacts.

---

## Pick List & SMT Part Numbers

| Qty | Part / Value | Package                | Designators    | JLCPCB / LCSC Part # | Manufacturer & Mfg Part # |
|:---:|:-------------|:-----------------------|:---------------|:---------------------|:--------------------------|
| 1   | ATMEGA324PB  | TQFP-44 SMD            | U_MCU          | C47751 / C2836854    | Microchip `ATMEGA324PB-AU` |
| 1   | 27.000 MHz   | 3225 4-SMD (3.2×2.5mm) | X1             | C136079              | Abracon `ABM8G-27.000MHZ-18-D2Y-T` |
| 1   | 0603 LED     | 0603 SMD               | LED1           | C72043 (or generic)  | Lite-On `LTST-C190GKT` (Green) |
| 2   | 18pF         | 0603 SMD ceramic (C0G) | C1, C3         | C1647                | Yageo `CC0603JRNPO9BN180` |
| 2   | 100nF (0.1µF)| 0603 SMD ceramic (X7R) | C2, C4         | C14663               | Yageo `CC0603KRX7R9BB104` |
| 3   | 2.2nF        | 0603 SMD ceramic (X7R) | C5, C6, C7     | C1604                | Yageo `CC0603KRX7R9BB222` |
| 3   | 3.6k         | 0603 SMD resistor      | R1, R2, R3     | C22980               | Yageo `RC0603FR-073K6L` |
| 1   | 1.4k (or 1.5k)| 0603 SMD resistor     | R4             | C2930049             | Yageo `RC0603FR-071K4L` *(or 1.5k)* |
| 2   | 1×20 Header  | Round Machined Male    | U_DIP          | Generic 0.1" pitch   | Mill-Max `350-10-120-00-006000` |
| 1   | 2×3 Header   | Male Pin Header        | J_ICSP         | Generic 0.1" pitch   | Sullins `PRPC003DAAN-RC` |

---

## US Distributor Sourcing (DigiKey & Mouser)

For builders hand-assembling bare PCBs with a hot air station (such as an 858D), all components can be sourced directly from major US distributors:

| Ref | Value / Description | Package | Manufacturer Part # | DigiKey Part # | Mouser Part # | Qty |
|:---|:---|:---|:---|:---|:---|:---:|
| **U_MCU** | ATmega324PB 8-bit MCU (20MHz/5V) | TQFP-44 (10×10 mm) | `ATMEGA324PB-AU` | `ATMEGA324PB-AU-ND` | `556-ATMEGA324PB-AU` | 1 |
| **X1** | 27.000 MHz Crystal (18pF load) | 3225 4-SMD (3.2×2.5 mm) | `ABM8G-27.000MHZ-18-D2Y-T` | `535-10499-1-ND` | `815-ABM8G-27-18-D2YT` | 1 |
| **C1, C3** | 18 pF 50V C0G/NP0 Ceramic Cap | 0603 SMD | `CC0603JRNPO9BN180` | `311-1065-1-ND` | `603-CC0603JRNPO9BN18` | 2 |
| **C2, C4** | 100 nF (0.1 µF) 50V X7R Ceramic Cap | 0603 SMD | `CC0603KRX7R9BB104` | `311-1341-1-ND` | `603-CC0603KRX7R9BB10` | 2 |
| **C5, C6, C7** | 2.2 nF (2200 pF) 50V X7R Ceramic Cap | 0603 SMD | `CC0603KRX7R9BB222` | `311-1088-1-ND` | `603-CC0603KRX7R9BB22` | 3 |
| **R1, R2, R3** | 3.6 kΩ 1/10W 1% Thick Film Resistor | 0603 SMD | `RC0603FR-073K6L` | `311-3.60KHRTR-ND` | `603-RC0603FR-073K6L` | 3 |
| **R4** | 1.4 kΩ (or 1.5 kΩ) 1% Resistor | 0603 SMD | `RC0603FR-071K4L` *(or 1.5k)* | `311-1.40KHRCT-ND` | `603-RC0603FR-071K4L` | 1 |
| **LED1** | 0603 SMD Green Indicator LED | 0603 SMD | `LTST-C190GKT` | `160-1446-1-ND` | `859-LTST-C190GKT` | 1 |
| **U_DIP** | 1×20 Round Machined Pin Header | 0.100" (2.54 mm) | `350-10-120-00-006000` | `ED90064-ND` | `575-3501012000006000` | 2 strips |
| **J_ICSP** | 2×3 Male Pin Header (0.1" pitch) | Dual row 0.1" | `PRPC003DAAN-RC` | `S1011EC-03-ND` | `649-PRPC003DAAN-RC` | 1 |

> [!TIP]
> **Order Extras for Passives:** 0603 resistors and capacitors cost ~$0.10 each on DigiKey/Mouser. Buying 5–10 of each value protects against parts flicked away by tweezers under hot air.

### Solder Paste & Rework Supplies (from DigiKey / Mouser)

- **Leaded Solder Paste Syringe (Sn63/Pb37, melts ~183°C):** Chip Quik `SMD291AX10T5` (DigiKey: `SMD291AX10T5-ND` / Mouser: `910-SMD291AX10T5`). Comes with dispensing needle tips.
- **Tacky No-Clean Flux Syringe:** Chip Quik `SMD291` (DigiKey: `SMD291-ND` / Mouser: `910-SMD291`).
- **Desoldering Braid / Wick (1.5mm):** Chemtronics Soder-Wick (DigiKey: `2097-1-ND` / Mouser: `516-80-2-5`).

---

### Alternative US Distributors & Retailers

- **[Arrow Electronics](https://www.arrow.com)** (Centennial, CO / Reno, NV) — Free shipping over $50; strong Microchip MCU and passives stock.
- **[Newark / element14](https://www.newark.com)** (Chicago, IL) — Microchip AVRs and Mill-Max interconnects.
- **[Jameco Electronics](https://www.jameco.com)** (Belmont, CA) — Classic hobbyist electronics distributor for through-hole pin headers and tools.
- **[Adafruit](https://www.adafruit.com)** (New York, NY) & **[SparkFun](https://www.sparkfun.com)** (Boulder, CO) — Great for headers, USBasp / AVR ISP programmers, and rework tweezers.

---

## ICSP Programming Header (`J_ICSP`) Pinout

Standard Atmel 6-pin ICSP header pinout:

```
  MISO (1) [o  o] (2) VCC (+5V)
   SCK (3) [o  o] (4) MOSI
 RESET (5) [o  o] (6) GND
```

| Pin | Net   | Connection to MCU |
|:---:|:------|:------------------|
|  1  | MISO  | PB6 (Pin 2)       |
|  2  | VCC   | +5V Rail          |
|  3  | SCK   | PB7 (Pin 3)       |
|  4  | MOSI  | PB5 (Pin 1)       |
|  5  | RESET | ~RESET (Pin 4)    |
|  6  | GND   | Ground Plane      |
