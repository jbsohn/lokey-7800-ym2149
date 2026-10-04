# Atari 7800 PLD Logic Makefile (galette compiler)

GALETTE    ?= galette
BUILD_DIR  := build

PLD_SRCS   := $(wildcard *.pld)
JED_FILES  := $(patsubst %.pld,$(BUILD_DIR)/%.jed,$(PLD_SRCS))

.PHONY: all clean help
.DELETE_ON_ERROR:

all: $(JED_FILES)

$(BUILD_DIR):
	@mkdir -p $(BUILD_DIR)

$(BUILD_DIR)/%.jed: %.pld | $(BUILD_DIR)
	@echo "  Compiling PLD [galette]: $< -> $@"
	@cp $< $(BUILD_DIR)/$*.pld
	@$(GALETTE) $(BUILD_DIR)/$*.pld
	@rm -f $(BUILD_DIR)/$*.pld

clean:
	@rm -rf $(BUILD_DIR)

help:
	@echo "Atari 7800 Cartridge PLD Build"
	@echo ""
	@echo "Targets:"
	@echo "  make all    Build all PLD fuse maps (.jed) into $(BUILD_DIR)/"
	@echo "  make clean  Remove $(BUILD_DIR)/"
