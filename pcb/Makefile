# Atari 7800 YM2149 PCB Makefile (tscircuit / Freerouting / KiCad CLI)

BUILD_DIR             := build
UNAME_S               := $(shell uname -s)

# --- KiCad CLI Setup ---
ifeq ($(UNAME_S),Darwin)
  KICAD_APP           ?= /Applications/KiCad/KiCad.app
  KICAD_CLI           ?= $(KICAD_APP)/Contents/MacOS/kicad-cli
  export PATH         := $(KICAD_APP)/Contents/MacOS:$(PATH)
else
  KICAD_CLI           ?= kicad-cli
endif
export KICAD_CLI

# --- Freerouting Setup ---
FREEROUTING_VERSION   ?= 2.4.1
FREEROUTING_SHA256    ?= 251101c3eeac22d7e7dfcf6796603279e5d1000283eb82d8f093780f7afc6aa9
FREEROUTING_URL       ?= https://github.com/freerouting/freerouting/releases/download/v$(FREEROUTING_VERSION)/freerouting-$(FREEROUTING_VERSION).jar
FREEROUTING_LOCAL     := .tools/freerouting-$(FREEROUTING_VERSION).jar
SHA256                := $(shell command -v sha256sum >/dev/null 2>&1 && echo sha256sum || echo shasum -a 256)

ifndef FREEROUTING_BIN
  FREEROUTING_JAR     ?= $(abspath $(FREEROUTING_LOCAL))
endif
export FREEROUTING_JAR

FREEROUTING_DEP       := $(if $(filter $(abspath $(FREEROUTING_LOCAL)),$(FREEROUTING_JAR)),$(FREEROUTING_LOCAL))

TS_COMPONENTS         := $(wildcard *.tsx) $(wildcard *.ts)

.PHONY: all help clean distclean freerouting pcb pcb-28pin pcb-32pin pcb-check \
        schematic schematic-28pin schematic-32pin previews previews-28pin previews-32pin
.DELETE_ON_ERROR:

all: pcb

node_modules: package.json bun.lock
	@echo "Installing PCB dependencies via bun..."
	@bun install
	@touch node_modules

freerouting: $(FREEROUTING_LOCAL)

$(FREEROUTING_LOCAL):
	@echo "Downloading Freerouting v$(FREEROUTING_VERSION)..."
	@mkdir -p $(dir $@)
	@curl -fsSL "$(FREEROUTING_URL)" -o "$@.part" || { rm -f "$@.part"; echo "Download failed: $(FREEROUTING_URL)"; exit 1; }
	@echo "$(FREEROUTING_SHA256)  $@.part" | $(SHA256) -c - >/dev/null 2>&1 || { rm -f "$@.part"; echo "SHA-256 mismatch for Freerouting v$(FREEROUTING_VERSION); refusing to use it"; exit 1; }
	@mv "$@.part" "$@"
	@echo "  $@ (SHA-256 verified)"

# --- PCB Build Rules ---
$(BUILD_DIR)/index-28pin.kicad_pcb: 28pin.circuit.tsx node_modules $(FREEROUTING_DEP) $(TS_COMPONENTS)
	@echo "Routing and exporting 28-pin PCB from tscircuit..."
	@bun build-pcb.ts 28pin.circuit.tsx

$(BUILD_DIR)/index-32pin.kicad_pcb: 32pin.circuit.tsx node_modules $(FREEROUTING_DEP) $(TS_COMPONENTS)
	@echo "Routing and exporting 32-pin PCB from tscircuit..."
	@bun build-pcb.ts 32pin.circuit.tsx

pcb-28pin: $(BUILD_DIR)/index-28pin.kicad_pcb

pcb-32pin: $(BUILD_DIR)/index-32pin.kicad_pcb

pcb: pcb-32pin

# Fast check: route both boards and run the DRC gate, without writing gerbers.
pcb-check: node_modules $(FREEROUTING_DEP)
	@bun build-pcb.ts 28pin.circuit.tsx --check
	@bun build-pcb.ts 32pin.circuit.tsx --check

# --- Schematic Exports ---
$(BUILD_DIR)/schematic-28pin.svg: 28pin.circuit.tsx node_modules
	@mkdir -p $(BUILD_DIR)
	@echo "Exporting 28-pin schematic SVG..."
	@bunx tsci export -f schematic-svg 28pin.circuit.tsx -o $(BUILD_DIR)/schematic-28pin.svg
	@if command -v rsvg-convert >/dev/null 2>&1; then \
		echo "Converting schematic SVG to PNG..."; \
		rsvg-convert -w 2048 $(BUILD_DIR)/schematic-28pin.svg -o $(BUILD_DIR)/schematic-28pin.png; \
	fi

$(BUILD_DIR)/schematic-32pin.svg: 32pin.circuit.tsx node_modules
	@mkdir -p $(BUILD_DIR)
	@echo "Exporting 32-pin schematic SVG..."
	@bunx tsci export -f schematic-svg 32pin.circuit.tsx -o $(BUILD_DIR)/schematic-32pin.svg
	@if command -v rsvg-convert >/dev/null 2>&1; then \
		echo "Converting schematic SVG to PNG..."; \
		rsvg-convert -w 2048 $(BUILD_DIR)/schematic-32pin.svg -o $(BUILD_DIR)/schematic-32pin.png; \
	fi

schematic-28pin: $(BUILD_DIR)/schematic-28pin.svg

schematic-32pin: $(BUILD_DIR)/schematic-32pin.svg

schematic: schematic-32pin

# --- KiCad Previews & 3D Renders ---
previews-28pin: $(BUILD_DIR)/index-28pin.kicad_pcb
	@echo "Exporting 28-pin PCB SVG previews from KiCad..."
	@$(KICAD_CLI) pcb export svg --mode-single --layers F.Cu,F.Silkscreen,F.Mask,Edge.Cuts --exclude-drawing-sheet --fit-page-to-board -o $(BUILD_DIR)/pcb_front_28pin.svg $(BUILD_DIR)/index-28pin.kicad_pcb
	@$(KICAD_CLI) pcb export svg --mode-single --layers B.Cu,B.Silkscreen,B.Mask,Edge.Cuts --exclude-drawing-sheet --fit-page-to-board --mirror -o $(BUILD_DIR)/pcb_back_28pin.svg $(BUILD_DIR)/index-28pin.kicad_pcb
	@if command -v rsvg-convert >/dev/null 2>&1; then \
		echo "Converting PCB SVGs to PNG..."; \
		rsvg-convert -w 2048 $(BUILD_DIR)/pcb_front_28pin.svg -o $(BUILD_DIR)/pcb_front_28pin.png; \
		rsvg-convert -w 2048 $(BUILD_DIR)/pcb_back_28pin.svg -o $(BUILD_DIR)/pcb_back_28pin.png; \
	fi
	@echo "Rendering 28-pin PCB 3D preview from KiCad..."
	@$(KICAD_CLI) pcb render --quality high --floor --rotate -45,0,45 --width 1600 --height 1200 --background opaque -o $(BUILD_DIR)/pcb_3d_28pin.png $(BUILD_DIR)/index-28pin.kicad_pcb

previews-32pin: $(BUILD_DIR)/index-32pin.kicad_pcb
	@echo "Exporting 32-pin PCB SVG previews from KiCad..."
	@$(KICAD_CLI) pcb export svg --mode-single --layers F.Cu,F.Silkscreen,F.Mask,Edge.Cuts --exclude-drawing-sheet --fit-page-to-board -o $(BUILD_DIR)/pcb_front_32pin.svg $(BUILD_DIR)/index-32pin.kicad_pcb
	@$(KICAD_CLI) pcb export svg --mode-single --layers B.Cu,B.Silkscreen,B.Mask,Edge.Cuts --exclude-drawing-sheet --fit-page-to-board --mirror -o $(BUILD_DIR)/pcb_back_32pin.svg $(BUILD_DIR)/index-32pin.kicad_pcb
	@if command -v rsvg-convert >/dev/null 2>&1; then \
		echo "Converting PCB SVGs to PNG..."; \
		rsvg-convert -w 2048 $(BUILD_DIR)/pcb_front_32pin.svg -o $(BUILD_DIR)/pcb_front_32pin.png; \
		rsvg-convert -w 2048 $(BUILD_DIR)/pcb_back_32pin.svg -o $(BUILD_DIR)/pcb_back_32pin.png; \
	fi
	@echo "Rendering 32-pin PCB 3D preview from KiCad..."
	@$(KICAD_CLI) pcb render --quality high --floor --rotate -45,0,45 --width 1600 --height 1200 --background opaque -o $(BUILD_DIR)/pcb_3d_32pin.png $(BUILD_DIR)/index-32pin.kicad_pcb

previews: previews-32pin

clean:
	@rm -rf $(BUILD_DIR)

distclean: clean
	@rm -rf node_modules .tools

help:
	@echo "Atari 7800 YM2149 PCB Build (tscircuit / KiCad)"
	@echo ""
	@echo "Targets:"
	@echo "  make freerouting    - Download pinned Freerouting jar into .tools/ (SHA-256 verified)"
	@echo "  make pcb-28pin      - Route and export 28-pin board (tscircuit -> Freerouting -> Gerbers)"
	@echo "  make pcb-32pin      - Route and export 32-pin board (tscircuit -> Freerouting -> Gerbers)"
	@echo "  make pcb            - Alias for 'make pcb-32pin'"
	@echo "  make pcb-check      - Fast route + DRC check of both boards (no gerbers)"
	@echo "  make schematic      - Export 32-pin schematic SVG/PNG"
	@echo "  make previews       - Render 32-pin PCB SVG previews and 3D PNG"
	@echo "  make clean          - Remove $(BUILD_DIR)/"
	@echo "  make distclean      - Remove $(BUILD_DIR)/, node_modules, and .tools/"
