# Atari 7800 Examples Makefile (ca65 / ld65 / a78tool / 7800sign)

CA65        ?= ca65
LD65        ?= ld65
A78TOOL     ?= a78tool
SIGN        ?= 7800sign

BUILD_DIR   := build
CA65_FLAGS  := -I .
LD65_FLAGS  := --cfg-path .

INCLUDES    := maria.inc stella.inc ym2149.inc

BANK_A78    := $(BUILD_DIR)/bank.a78
BANK_ROM    := $(BUILD_DIR)/bank.rom
COLOR_A78   := $(BUILD_DIR)/color_test.a78
COLOR_ROM   := $(BUILD_DIR)/color_test.rom
COLOR_256K  := $(BUILD_DIR)/color_test_256k.rom

.PHONY: all bank color_test rom a78 clean help
.DELETE_ON_ERROR:
.PRECIOUS: $(BUILD_DIR)/%.o $(BUILD_DIR)/%.bin $(BUILD_DIR)/%.rom

all: bank color_test

bank: $(BANK_A78) $(BANK_ROM)

color_test: $(COLOR_A78) $(COLOR_ROM) $(COLOR_256K)

rom: $(BANK_ROM) $(COLOR_ROM) $(COLOR_256K)

a78: $(BANK_A78) $(COLOR_A78)

$(BUILD_DIR):
	@mkdir -p $(BUILD_DIR)

# --- Assembly ---
$(BUILD_DIR)/%.o: %.s $(INCLUDES) | $(BUILD_DIR)
	@echo "  Assembling [ca65]: $<"
	@$(CA65) $(CA65_FLAGS) $< -o $@

# --- Linking ---
$(BUILD_DIR)/bank.bin: $(BUILD_DIR)/bank.o a7800_banked.cfg | $(BUILD_DIR)
	@echo "  Linking [ld65]: $@"
	@$(LD65) $(LD65_FLAGS) -C a7800_banked.cfg $< -o $@

$(BUILD_DIR)/%.bin: $(BUILD_DIR)/%.o a7800.cfg | $(BUILD_DIR)
	@echo "  Linking [ld65]: $@"
	@$(LD65) $(LD65_FLAGS) -C a7800.cfg $< -o $@

# --- Signing ---
$(BUILD_DIR)/%.rom: $(BUILD_DIR)/%.bin
	@echo "  Signing ROM [7800sign]: $@"
	@cp $< $@
	@$(SIGN) -w "$@" >/dev/null 2>&1 || true
	@$(SIGN) -t "$@" >/dev/null 2>&1 || true

# --- Packaging (.a78) ---
$(BUILD_DIR)/bank.a78: $(BUILD_DIR)/bank.rom bank.json
	@echo "  Packaging banked ROM [a78tool]: $@"
	@$(A78TOOL) generate -i $< -o $@ -c bank.json

$(BUILD_DIR)/%.a78: $(BUILD_DIR)/%.rom header.json
	@echo "  Packaging ROM [a78tool]: $@"
	@$(A78TOOL) generate -i $< -o $@ -c header.json

# --- 256KB Mirrored ROM ---
$(BUILD_DIR)/color_test_256k.rom: $(BUILD_DIR)/color_test.rom
	@echo "  Creating 256KB mirrored ROM (8x 32KB): $@"
	@cat $< $< $< $< $< $< $< $< > $@

clean:
	@rm -rf $(BUILD_DIR)

help:
	@echo "Atari 7800 Assembly & ROM Build (ca65 / ld65)"
	@echo ""
	@echo "Targets:"
	@echo "  make all        - Build all ROMs (bank and color_test)"
	@echo "  make bank       - Build 512KB banked demo (.a78 + .rom)"
	@echo "  make color_test - Build 32KB fixed color test (.a78 + .rom + 256k mirrored)"
	@echo "  make a78        - Build all .a78 emulator ROMs"
	@echo "  make rom        - Build all raw/signed .rom binaries"
	@echo "  make clean      - Remove $(BUILD_DIR)/"
