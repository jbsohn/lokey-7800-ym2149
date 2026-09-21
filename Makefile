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
  KICAD_CLI    ?= $(KICAD_APP)/Contents/MacOS/kicad-cli
  export PATH  := $(KICAD_APP)/Contents/MacOS:$(PATH)
else
  KICAD_CLI    ?= kicad-cli
endif
export KICAD_CLI

# --- Freerouting Setup (pinned, checksum-verified download) ---
# `make freerouting` fetches the jar into pcb/.tools/. FREEROUTING_JAR from the environment (CI,
# devcontainer) or FREEROUTING_BIN (an executable on PATH) take precedence over the local copy.
FREEROUTING_VERSION ?= 2.4.1
FREEROUTING_SHA256  ?= 251101c3eeac22d7e7dfcf6796603279e5d1000283eb82d8f093780f7afc6aa9
FREEROUTING_URL     ?= https://github.com/freerouting/freerouting/releases/download/v$(FREEROUTING_VERSION)/freerouting-$(FREEROUTING_VERSION).jar
FREEROUTING_LOCAL   := pcb/.tools/freerouting-$(FREEROUTING_VERSION).jar
SHA256              := $(shell command -v sha256sum >/dev/null 2>&1 && echo sha256sum || echo shasum -a 256)
ifndef FREEROUTING_BIN
  FREEROUTING_JAR ?= $(abspath $(FREEROUTING_LOCAL))
endif
export FREEROUTING_JAR
# Only depend on the download when the build actually uses the local copy.
FREEROUTING_DEP     := $(if $(filter $(abspath $(FREEROUTING_LOCAL)),$(FREEROUTING_JAR)),$(FREEROUTING_LOCAL))

# --- Demos & Targets ---
BANKED_A78S    := $(BUILD_DIR)/bank.a78
BANKED_ROMS    := $(BUILD_DIR)/bank.rom

.PHONY: all help clean distclean logic rom a78 freerouting pcb pcb-28pin pcb-32pin pcb-check schematic schematic-28pin schematic-32pin previews previews-28pin previews-32pin bank

all: bank logic

# --- PCB Targets ---
pcb/node_modules: pcb/package.json
	@echo "Installing PCB dependencies in pcb/..."
	@cd pcb && bun install
	@touch pcb/node_modules

freerouting: $(FREEROUTING_LOCAL)

$(FREEROUTING_LOCAL):
	@echo "Downloading Freerouting v$(FREEROUTING_VERSION)..."
	@mkdir -p $(dir $@)
	@curl -fsSL "$(FREEROUTING_URL)" -o "$@.part" || { rm -f "$@.part"; echo "Download failed: $(FREEROUTING_URL)"; exit 1; }
	@echo "$(FREEROUTING_SHA256)  $@.part" | $(SHA256) -c - >/dev/null 2>&1 || { rm -f "$@.part"; echo "SHA-256 mismatch for Freerouting v$(FREEROUTING_VERSION); refusing to use it"; exit 1; }
	@mv "$@.part" "$@"
	@echo "  $@ (SHA-256 verified)"

pcb-28pin: pcb/node_modules $(FREEROUTING_DEP)
	@echo "Routing and exporting 28-pin PCB from tscircuit..."
	@cd pcb && bun build-pcb.ts 28pin.circuit.tsx

pcb-32pin: pcb/node_modules $(FREEROUTING_DEP)
	@echo "Routing and exporting 32-pin PCB from tscircuit..."
	@cd pcb && bun build-pcb.ts 32pin.circuit.tsx

pcb: pcb-32pin

# Fast check: route both boards and run the DRC gate, without writing gerbers.
pcb-check: pcb/node_modules $(FREEROUTING_DEP)
	@cd pcb && bun build-pcb.ts 28pin.circuit.tsx --check
	@cd pcb && bun build-pcb.ts 32pin.circuit.tsx --check

schematic-28pin: pcb/node_modules
	@echo "Exporting 28-pin schematic SVG..."
	@mkdir -p $(BUILD_DIR)
	@cd pcb && bunx tsci export -f schematic-svg 28pin.circuit.tsx -o ../$(BUILD_DIR)/schematic-28pin.svg
	@if command -v rsvg-convert >/dev/null 2>&1; then \
		echo "Converting schematic SVG to PNG..."; \
		rsvg-convert -w 2048 $(BUILD_DIR)/schematic-28pin.svg -o $(BUILD_DIR)/schematic-28pin.png; \
	else \
		echo "Warning: 'rsvg-convert' not found. Skipping PNG schematic generation (only SVG created)."; \
	fi

schematic-32pin: pcb/node_modules
	@echo "Exporting 32-pin schematic SVG..."
	@mkdir -p $(BUILD_DIR)
	@cd pcb && bunx tsci export -f schematic-svg 32pin.circuit.tsx -o ../$(BUILD_DIR)/schematic-32pin.svg
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
	@$(KICAD_CLI) pcb export svg --mode-single --layers F.Cu,F.Silkscreen,F.Mask,Edge.Cuts --exclude-drawing-sheet --fit-page-to-board -o $(BUILD_DIR)/pcb_front_28pin.svg pcb/build/index-28pin.kicad_pcb
	@$(KICAD_CLI) pcb export svg --mode-single --layers B.Cu,B.Silkscreen,B.Mask,Edge.Cuts --exclude-drawing-sheet --fit-page-to-board --mirror -o $(BUILD_DIR)/pcb_back_28pin.svg pcb/build/index-28pin.kicad_pcb
	@if command -v rsvg-convert >/dev/null 2>&1; then \
		echo "Converting PCB SVGs to PNG..."; \
		rsvg-convert -w 2048 $(BUILD_DIR)/pcb_front_28pin.svg -o $(BUILD_DIR)/pcb_front_28pin.png; \
		rsvg-convert -w 2048 $(BUILD_DIR)/pcb_back_28pin.svg -o $(BUILD_DIR)/pcb_back_28pin.png; \
	fi
	@echo "Rendering 28-pin PCB 3D preview from KiCad..."
	@$(KICAD_CLI) pcb render --quality high --floor --rotate -45,0,45 --width 1600 --height 1200 --background opaque -o $(BUILD_DIR)/pcb_3d_28pin.png pcb/build/index-28pin.kicad_pcb

previews-32pin: pcb/build/index-32pin.kicad_pcb
	@echo "Exporting 32-pin PCB SVG previews from KiCad..."
	@mkdir -p $(BUILD_DIR)
	@$(KICAD_CLI) pcb export svg --mode-single --layers F.Cu,F.Silkscreen,F.Mask,Edge.Cuts --exclude-drawing-sheet --fit-page-to-board -o $(BUILD_DIR)/pcb_front_32pin.svg pcb/build/index-32pin.kicad_pcb
	@$(KICAD_CLI) pcb export svg --mode-single --layers B.Cu,B.Silkscreen,B.Mask,Edge.Cuts --exclude-drawing-sheet --fit-page-to-board --mirror -o $(BUILD_DIR)/pcb_back_32pin.svg pcb/build/index-32pin.kicad_pcb
	@if command -v rsvg-convert >/dev/null 2>&1; then \
		echo "Converting PCB SVGs to PNG..."; \
		rsvg-convert -w 2048 $(BUILD_DIR)/pcb_front_32pin.svg -o $(BUILD_DIR)/pcb_front_32pin.png; \
		rsvg-convert -w 2048 $(BUILD_DIR)/pcb_back_32pin.svg -o $(BUILD_DIR)/pcb_back_32pin.png; \
	fi
	@echo "Rendering 32-pin PCB 3D preview from KiCad..."
	@$(KICAD_CLI) pcb render --quality high --floor --rotate -45,0,45 --width 1600 --height 1200 --background opaque -o $(BUILD_DIR)/pcb_3d_32pin.png pcb/build/index-32pin.kicad_pcb

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
	@rm -rf pcb/node_modules pcb/.tools

help:
	@echo "Atari 7800 YM2149 Cartridge Build System (ca65 / ld65)"
	@echo ""
	@echo "Targets:"
	@echo "  make bank      - Build 32-pin bank-select chromatic scale demo (.a78 + .rom)"
	@echo "  make freerouting - Download the pinned Freerouting jar into pcb/.tools (SHA-256 verified)"
	@echo "  make pcb-28pin - Build 28-pin board PCB (tscircuit -> Freerouting -> Gerbers)"
	@echo "  make pcb-32pin - Build 32-pin board PCB (tscircuit -> Freerouting -> Gerbers)"
	@echo "  make pcb       - Alias for 'make pcb-32pin'"
	@echo "  make pcb-check - Fast route + DRC check of both boards (no gerbers)"
	@echo "  make previews  - Export front/back SVG previews of current PCB design"
	@echo "  make logic     - Build PLD logic files (.jed via galette)"
	@echo "  make clean     - Wipe build artifacts"
	@echo "  make distclean - Wipe build artifacts AND pcb/node_modules and pcb/.tools"
