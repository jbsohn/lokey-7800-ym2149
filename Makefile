# Atari 7800 YM2149 Top-Level Makefile
# Delegates builds to subprojects: examples, pld, and pcb

.PHONY: all roms examples bank color_test rom a78 \
        logic pld \
        pcb pcb-28pin pcb-32pin pcb-check pcb-verify freerouting \
        schematic schematic-28pin schematic-32pin \
        previews previews-28pin previews-32pin \
        clean distclean help

all: roms logic

# --- 6502 Assembly & ROM Targets (examples/) ---
roms:
	@$(MAKE) -C examples all

examples: roms

bank:
	@$(MAKE) -C examples bank

color_test:
	@$(MAKE) -C examples color_test

rom:
	@$(MAKE) -C examples rom

a78:
	@$(MAKE) -C examples a78

# --- PLD Logic Targets (pld/) ---
logic:
	@$(MAKE) -C pld all

pld: logic

# --- PCB Targets (pcb/) ---
pcb:
	@$(MAKE) -C pcb pcb

pcb-28pin:
	@$(MAKE) -C pcb pcb-28pin

pcb-32pin:
	@$(MAKE) -C pcb pcb-32pin

pcb-check:
	@$(MAKE) -C pcb pcb-check

pcb-verify:
	@$(MAKE) -C pcb pcb-verify

freerouting:
	@$(MAKE) -C pcb freerouting

schematic:
	@$(MAKE) -C pcb schematic

schematic-28pin:
	@$(MAKE) -C pcb schematic-28pin

schematic-32pin:
	@$(MAKE) -C pcb schematic-32pin

previews:
	@$(MAKE) -C pcb previews

previews-28pin:
	@$(MAKE) -C pcb previews-28pin

previews-32pin:
	@$(MAKE) -C pcb previews-32pin

# --- Clean Targets ---
clean:
	@echo "=== Cleaning subprojects ==="
	@$(MAKE) -C examples clean
	@$(MAKE) -C pld clean
	@$(MAKE) -C pcb clean
	@rm -rf build

distclean: clean
	@$(MAKE) -C pcb distclean

help:
	@echo "Atari 7800 YM2149 Build System"
	@echo ""
	@echo "Subprojects:"
	@echo "  examples/       - 6502 assembly ROMs (ca65 / ld65)"
	@echo "  pld/            - GAL/ATF PLD logic equations (galette)"
	@echo "  pcb/            - Hardware layout and Gerbers (tscircuit / KiCad)"
	@echo ""
	@echo "Primary Targets:"
	@echo "  make all        - Build ROMs and PLD logic (default)"
	@echo "  make roms       - Build all sample ROMs (.a78 + .rom)"
	@echo "  make bank       - Build 512KB banked demo ROM"
	@echo "  make color_test - Build 32KB fixed color test ROM"
	@echo "  make logic      - Compile PLD fuse maps (.jed via galette)"
	@echo "  make pcb        - Route and export 32-pin PCB Gerbers"
	@echo "  make pcb-28pin  - Route and export 28-pin PCB Gerbers"
	@echo "  make pcb-check  - Fast route + DRC check of both boards"
	@echo "  make previews   - Render PCB SVG previews and 3D PNG"
	@echo "  make clean      - Clean build artifacts across all subprojects"
	@echo "  make distclean  - Clean all artifacts including node_modules and .tools"
