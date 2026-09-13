# Atari 7800 YM2149 Project Makefile (ca65 / cc65 toolchain)

# --- Toolchain Setup ---
CA65                  := ca65
LD65                  := ld65
A78TOOL               := a78tool
SIGN                  := 7800sign

# --- Configuration & Directories ---
BUILD_DIR             := build
SRC_DIR               := examples
INC_DIR               := examples

CA65_FLAGS            := -I $(INC_DIR)
LD65_FLAGS            := --cfg-path $(SRC_DIR)

# --- OS Detection & KiCad Setup ---
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
  KICAD_APP    ?= /Applications/KiCad/KiCad.app
  KICAD_PYTHON ?= $(KICAD_APP)/Contents/Frameworks/Python.framework/Versions/3.9/bin/python3
  export PATH  := $(KICAD_APP)/Contents/MacOS:$(PATH)
else
  KICAD_PYTHON ?= python3
endif

# --- Demos & Targets ---
BANKED_A78S    := $(BUILD_DIR)/bank.a78
BANKED_ROMS    := $(BUILD_DIR)/bank.rom

.PHONY: all help clean distclean logic rom a78 pcb pcb-28pin pcb-32pin schematic schematic-28pin schematic-32pin previews previews-28pin previews-32pin bank

all: bank logic

# --- PCB Targets ---
pcb/node_modules: pcb/package.json
	@echo "Installing PCB dependencies in pcb/..."
	@cd pcb && npm install
	@touch pcb/node_modules

pcb-28pin: pcb/node_modules
	@echo "Exporting and autorouting 28-pin PCB from tscircuit..."
	@cd pcb && $(KICAD_PYTHON) ./route_and_patch.py 28pin.circuit.tsx

pcb-32pin: pcb/node_modules
	@echo "Exporting and autorouting 32-pin PCB from tscircuit..."
	@cd pcb && $(KICAD_PYTHON) ./route_and_patch.py 32pin.circuit.tsx

pcb: pcb-32pin

schematic-28pin: pcb/node_modules
	@echo "Exporting 28-pin schematic SVG..."
	@mkdir -p $(BUILD_DIR)
	@cd pcb && npx tsci export -f schematic-svg 28pin.circuit.tsx -o ../$(BUILD_DIR)/schematic-28pin.svg
	@if command -v rsvg-convert >/dev/null 2>&1; then \
		echo "Converting schematic SVG to PNG..."; \
		rsvg-convert -w 2048 $(BUILD_DIR)/schematic-28pin.svg -o $(BUILD_DIR)/schematic-28pin.png; \
	else \
		echo "Warning: 'rsvg-convert' not found. Skipping PNG schematic generation (only SVG created)."; \
	fi

schematic-32pin: pcb/node_modules
	@echo "Exporting 32-pin schematic SVG..."
	@mkdir -p $(BUILD_DIR)
	@cd pcb && npx tsci export -f schematic-svg 32pin.circuit.tsx -o ../$(BUILD_DIR)/schematic-32pin.svg
	@if command -v rsvg-convert >/dev/null 2>&1; then \
		echo "Converting schematic SVG to PNG..."; \
		rsvg-convert -w 2048 $(BUILD_DIR)/schematic-32pin.svg -o $(BUILD_DIR)/schematic-32pin.png; \
	else \
		echo "Warning: 'rsvg-convert' not found. Skipping PNG schematic generation (only SVG created)."; \
	fi

schematic: schematic-32pin

previews-28pin: pcb/build/index-28pin.kicad_pcb
	@echo "Exporting 28-pin PCB SVG previews from KiCad..."
	@mkdir -p $(BUILD_DIR)
	@kicad-cli pcb export svg --mode-single --layers F.Cu,F.Silkscreen,F.Mask,Edge.Cuts --exclude-drawing-sheet --fit-page-to-board -o $(BUILD_DIR)/pcb_front_28pin.svg pcb/build/index-28pin.kicad_pcb
	@kicad-cli pcb export svg --mode-single --layers B.Cu,B.Silkscreen,B.Mask,Edge.Cuts --exclude-drawing-sheet --fit-page-to-board --mirror -o $(BUILD_DIR)/pcb_back_28pin.svg pcb/build/index-28pin.kicad_pcb
	@if command -v rsvg-convert >/dev/null 2>&1; then \
		echo "Converting PCB SVGs to PNG..."; \
		rsvg-convert -w 2048 $(BUILD_DIR)/pcb_front_28pin.svg -o $(BUILD_DIR)/pcb_front_28pin.png; \
		rsvg-convert -w 2048 $(BUILD_DIR)/pcb_back_28pin.svg -o $(BUILD_DIR)/pcb_back_28pin.png; \
	fi
	@echo "Rendering 28-pin PCB 3D preview from KiCad..."
	@kicad-cli pcb render --quality high --floor --rotate -45,0,45 --width 1600 --height 1200 --background opaque -o $(BUILD_DIR)/pcb_3d_28pin.png pcb/build/index-28pin.kicad_pcb

previews-32pin: pcb/build/index-32pin.kicad_pcb
	@echo "Exporting 32-pin PCB SVG previews from KiCad..."
	@mkdir -p $(BUILD_DIR)
	@kicad-cli pcb export svg --mode-single --layers F.Cu,F.Silkscreen,F.Mask,Edge.Cuts --exclude-drawing-sheet --fit-page-to-board -o $(BUILD_DIR)/pcb_front_32pin.svg pcb/build/index-32pin.kicad_pcb
	@kicad-cli pcb export svg --mode-single --layers B.Cu,B.Silkscreen,B.Mask,Edge.Cuts --exclude-drawing-sheet --fit-page-to-board --mirror -o $(BUILD_DIR)/pcb_back_32pin.svg pcb/build/index-32pin.kicad_pcb
	@if command -v rsvg-convert >/dev/null 2>&1; then \
		echo "Converting PCB SVGs to PNG..."; \
		rsvg-convert -w 2048 $(BUILD_DIR)/pcb_front_32pin.svg -o $(BUILD_DIR)/pcb_front_32pin.png; \
		rsvg-convert -w 2048 $(BUILD_DIR)/pcb_back_32pin.svg -o $(BUILD_DIR)/pcb_back_32pin.png; \
	fi
	@echo "Rendering 32-pin PCB 3D preview from KiCad..."
	@kicad-cli pcb render --quality high --floor --rotate -45,0,45 --width 1600 --height 1200 --background opaque -o $(BUILD_DIR)/pcb_3d_32pin.png pcb/build/index-32pin.kicad_pcb

previews: previews-32pin

# --- Assembly & ROM Rules (ca65 / ld65) ---

rom: $(BUILD_DIR) $(BANKED_ROMS)

a78: $(BUILD_DIR) $(BANKED_A78S)

bank: $(BUILD_DIR) $(BANKED_A78S) $(BANKED_ROMS)

$(BUILD_DIR):
	@mkdir -p $(BUILD_DIR)

$(BUILD_DIR)/%.o: $(SRC_DIR)/%.s | $(BUILD_DIR)
	@echo "  Assembling [ca65]: $<"
	@$(CA65) $(CA65_FLAGS) $< -o $@

$(BUILD_DIR)/bank.bin: $(BUILD_DIR)/bank.o | $(BUILD_DIR)
	@echo "  Linking [ld65]: $@"
	@$(LD65) $(LD65_FLAGS) -C a7800_banked.cfg $< -o $@

$(BUILD_DIR)/%.bin: $(BUILD_DIR)/%.o | $(BUILD_DIR)
	@echo "  Linking [ld65]: $@"
	@$(LD65) $(LD65_FLAGS) -C a7800.cfg $< -o $@

$(BUILD_DIR)/%.rom: $(BUILD_DIR)/%.bin
	@cp $< $@
	@$(SIGN) -w "$@" >/dev/null 2>&1 || true
	@$(SIGN) -t "$@" >/dev/null 2>&1 || true

$(BUILD_DIR)/bank.a78: $(BUILD_DIR)/bank.rom $(SRC_DIR)/bank.json
	@echo "  Packaging banked ROM [a78tool]: $@"
	@$(A78TOOL) generate -i $< -o $@ -c $(SRC_DIR)/bank.json

$(BUILD_DIR)/%.a78: $(BUILD_DIR)/%.rom header.json
	@echo "  Packaging ROM [a78tool]: $@"
	@$(A78TOOL) generate -i $< -o $@ -c header.json

# --- Logic Rules ---
logic: $(BUILD_DIR)
	@echo "Building 28-pin and 32-pin board PLD JED files from .pld sources..."
	@galette pld/rom_ym_28pin.pld
	@galette pld/rom_ym_32pin.pld
	@mv pld/*.jed $(BUILD_DIR)/ 2>/dev/null || true

clean:
	@rm -rf $(BUILD_DIR)
	@rm -rf pcb/build/

distclean: clean
	@rm -rf pcb/node_modules

help:
	@echo "Atari 7800 YM2149 Cartridge Build System (ca65 / ld65)"
	@echo ""
	@echo "Targets:"
	@echo "  make bank      - Build 32-pin bank-select chromatic scale demo (.a78 + .rom)"
	@echo "  make pcb-28pin - Build 28-pin board PCB (tscircuit -> Freerouting -> Gerbers)"
	@echo "  make pcb-32pin - Build 32-pin board PCB (tscircuit -> Freerouting -> Gerbers)"
	@echo "  make pcb       - Alias for 'make pcb-32pin'"
	@echo "  make previews  - Export front/back SVG previews of current PCB design"
	@echo "  make logic     - Build PLD logic files (.jed via galette)"
	@echo "  make clean     - Wipe build artifacts"
	@echo "  make distclean - Wipe build artifacts AND pcb/node_modules"
