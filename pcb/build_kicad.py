#!/usr/bin/env python3
"""
KiCad-centric build pipeline for Atari 7800 PCB:
1. Export unrouted .kicad_pcb from TSCircuit React
2. Write KiCad project settings (.kicad_pro) and custom rules (.kicad_dru)
3. Use pcbnew to export Specctra DSN
4. Patch DSN:
   - Add clearance 0 for pcb and smd_pcb so card edge & notch route cleanly
5. Route via Freerouting CLI (headless)
6. Use pcbnew to import Specctra SES into the board
7. Use kicad-cli to refill zones, run DRC, and export Gerbers/drill files
"""

import sys
import os
import re
import json
import subprocess
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(SCRIPT_DIR)

CHECK_ONLY = "--check" in sys.argv
args = [a for a in sys.argv[1:] if not a.startswith("--")]
ENTRY = args[0] if args else "32pin.circuit.tsx"
BOARD_NAME = os.path.basename(ENTRY).split(".")[0]

BUILD_DIR = os.path.join(SCRIPT_DIR, "build")
os.makedirs(BUILD_DIR, exist_ok=True)

PCB_PATH = os.path.join(BUILD_DIR, f"index-{BOARD_NAME}.kicad_pcb")
PRO_PATH = os.path.join(BUILD_DIR, f"index-{BOARD_NAME}.kicad_pro")
DRU_PATH = os.path.join(BUILD_DIR, f"index-{BOARD_NAME}.kicad_dru")
DSN_PATH = os.path.join(BUILD_DIR, f"{BOARD_NAME}.dsn")
SES_PATH = os.path.join(BUILD_DIR, f"{BOARD_NAME}.ses")
DRC_JSON = os.path.join(BUILD_DIR, f"index-{BOARD_NAME}-drc.json")
GERBER_DIR = os.path.join(BUILD_DIR, f"gerbers-{BOARD_NAME}")
ZIP_PATH = os.path.join(BUILD_DIR, f"gerbers-{BOARD_NAME}.zip")

FREEROUTING_JAR = os.environ.get(
    "FREEROUTING_JAR",
    os.path.join(SCRIPT_DIR, ".tools", "freerouting-2.4.1.jar")
)

def log(msg):
    print(f"\n===> {msg}")

# -----------------------------------------------------------------------------
# Export from TSCircuit to KiCad PCB
# -----------------------------------------------------------------------------
log(f"Exporting unrouted board from TSCircuit ({ENTRY})...")
cmd_export = ["bunx", "tsci", "export", ENTRY, "-f", "kicad_pcb", "-o", PCB_PATH]
subprocess.run(cmd_export, check=True)

# -----------------------------------------------------------------------------
# Write KiCad Project Settings (.kicad_pro) & Design Rules (.kicad_dru)
# -----------------------------------------------------------------------------
log("Configuring KiCad project settings & custom rules...")

pro_config = {
    "meta": {"filename": f"index-{BOARD_NAME}.kicad_pro", "version": 1},
    "board": {
        "design_settings": {
            "rules": {
                "min_track_width": 0.15,
                "min_via_diameter": 0.6,
                "min_through_hole_diameter": 0.3,
                "min_via_annular_width": 0.15,
                "min_copper_edge_clearance": 0.2,
            },
            "rule_severities": {
                "lib_footprint_issues": "ignore",
                "text_height": "ignore",
                "text_thickness": "ignore",
                "pth_inside_courtyard": "ignore",
                "unconnected_items": "warning",
            },
        }
    },
}
with open(PRO_PATH, "w") as f:
    json.dump(pro_config, f, indent=2)

# Custom rules for card edge and connector notch escape
dru_rules = """(version 1)

# Board standard copper clearance (0.15mm / 6 mil)
(rule "board_clearance"
  (constraint clearance (min 0.15mm))
)

# J1 is an Atari 7800 card-edge connector — pads intentionally sit at the board edge.
(rule "J1_card_edge_clearance"
  (constraint edge_clearance (min 0mm))
  (condition "A.Reference == 'J1' || B.Reference == 'J1'")
)

# Escape tracks through the connector notch
(rule "connector_notch_escape_clearance"
  (constraint edge_clearance (min 0mm))
  (condition "A.NetName == 'HALT' || B.NetName == 'HALT' || A.NetName == 'PHI2' || B.NetName == 'PHI2' || A.NetName == 'RW' || B.NetName == 'RW' || A.NetName == 'A13' || B.NetName == 'A13' || A.NetName == 'A14' || B.NetName == 'A14'")
)
"""
with open(DRU_PATH, "w") as f:
    f.write(dru_rules)

# -----------------------------------------------------------------------------
# Export Specctra DSN using pcbnew
# -----------------------------------------------------------------------------
log("Exporting Specctra DSN using pcbnew...")
import pcbnew

board = pcbnew.LoadBoard(PCB_PATH)
if os.path.exists(DSN_PATH):
    os.remove(DSN_PATH)

ok = pcbnew.ExportSpecctraDSN(board, DSN_PATH)
if not ok or not os.path.exists(DSN_PATH):
    print("Error: pcbnew.ExportSpecctraDSN failed.")
    sys.exit(1)

# -----------------------------------------------------------------------------
# Patch DSN (Edge Clearances for Freerouting)
# -----------------------------------------------------------------------------
log("Patching DSN rules...")
with open(DSN_PATH, "r") as f:
    dsn = f.read()

dsn = re.sub(
    r"(\(rule\s*\(width \d+\)\s*\(clearance \d+(?:\s*\(type smd_smd\))?\)\s*\))",
    r"\1\n      (clearance 0 (type smd_pcb))\n      (clearance 0 (type pcb))",
    dsn,
)

with open(DSN_PATH, "w") as f:
    f.write(dsn)

# -----------------------------------------------------------------------------
# Route via Freerouting CLI
# -----------------------------------------------------------------------------
log("Autorouting with Freerouting...")
if os.path.exists(SES_PATH):
    os.remove(SES_PATH)

fr_cmd = [
    "java",
    "-Djava.awt.headless=true",
    "-jar",
    FREEROUTING_JAR,
    "-de",
    DSN_PATH,
    "-do",
    SES_PATH,
    "-mp",
    "15",
]
fr_res = subprocess.run(fr_cmd)

if fr_res.returncode != 0 or not os.path.exists(SES_PATH):
    print("Error: Freerouting failed to generate session (.ses) file.")
    sys.exit(1)

# -----------------------------------------------------------------------------
# Import Specctra SES using pcbnew
# -----------------------------------------------------------------------------
log("Importing Specctra SES back into KiCad board...")
board = pcbnew.LoadBoard(PCB_PATH)
pcbnew.ImportSpecctraSES(board, SES_PATH)
board.Save(PCB_PATH)

# -----------------------------------------------------------------------------
# Refill Zones & Run DRC via kicad-cli
# -----------------------------------------------------------------------------
log("Refilling copper zones and running DRC via kicad-cli...")
drc_cmd = [
    "kicad-cli",
    "pcb",
    "drc",
    "--format",
    "json",
    "--severity-error",
    "--severity-warning",
    "--refill-zones",
    "--save-board",
    "-o",
    DRC_JSON,
    PCB_PATH,
]
subprocess.run(drc_cmd, check=False)

if os.path.exists(DRC_JSON):
    with open(DRC_JSON) as f:
        drc_data = json.load(f)
    violations = drc_data.get("violations", [])
    unconnected = drc_data.get("unconnected_items", [])
    print(f"\n================ DRC REPORT ================")
    print(f"  Board: {BOARD_NAME}")
    print(f"  Violations: {len(violations)}")
    print(f"  Unconnected: {len(unconnected)}")
    print("============================================")

if CHECK_ONLY:
    log("Check-only run finished.")
    sys.exit(0)

# -----------------------------------------------------------------------------
# 8. Export Gerbers & Drill Files
# -----------------------------------------------------------------------------
log("Exporting fabrication Gerbers & drill files...")
os.makedirs(GERBER_DIR, exist_ok=True)

subprocess.run([
    "kicad-cli", "pcb", "export", "gerbers",
    "-o", GERBER_DIR,
    PCB_PATH
], check=True)

subprocess.run([
    "kicad-cli", "pcb", "export", "drill",
    "-o", GERBER_DIR,
    PCB_PATH
], check=True)

# Package into zip
log(f"Zipping Gerbers to {ZIP_PATH}...")
if os.path.exists(ZIP_PATH):
    os.remove(ZIP_PATH)

shutil.make_archive(GERBER_DIR, "zip", GERBER_DIR)
print(f"Gerbers ready: {ZIP_PATH}")

log("Pipeline run complete.")
