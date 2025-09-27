#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
# These paths are relative to the repository root where the workflow runs.
MODULE_TEMPLATE_DIR="scripts/module"
INPUT_ANIMATION="bootanimation.zip"
STAGING_DIR="staging"

# --- Validation ---
# Ensure a Job ID was passed as the first argument.
if [ -z "$1" ]; then
  echo "Error: Job ID not provided."
  echo "Usage: ./package_module.sh <jobId>"
  exit 1
fi

if [ ! -f "$INPUT_ANIMATION" ]; then
    echo "Error: Input file '$INPUT_ANIMATION' not found."
    exit 1
fi

if [ ! -d "$MODULE_TEMPLATE_DIR" ]; then
    echo "Error: Module template directory '$MODULE_TEMPLATE_DIR' not found."
    exit 1
fi

JOB_ID=$1
FINAL_MODULE_NAME="MagiBoot-Animation-${JOB_ID}.zip"

echo "📦 Starting module packaging..."

# --- Assembly ---
# 1. Create a clean staging directory.
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"
echo "  > Created staging directory."

# 2. Copy the module template files into the staging area.
cp "$MODULE_TEMPLATE_DIR"/config.sh "$STAGING_DIR"/
cp "$MODULE_TEMPLATE_DIR"/module.prop "$STAGING_DIR"/
cp "$MODULE_TEMPLATE_DIR"/customize.sh "$STAGING_DIR"/
cp "$MODULE_TEMPLATE_DIR"/uninstall.sh "$STAGING_DIR"/
echo "  > Copied module template."

# 3. Source the config file to get the target animation filename.
source "$MODULE_TEMPLATE_DIR/config.sh"

# 4. Move the generated bootanimation into the staging area with the correct name.
mv "$INPUT_ANIMATION" "$STAGING_DIR/$BOOTANIMATION_FILE"
echo "  > Added bootanimation as '$BOOTANIMATION_FILE'."

# 5. Create the final flashable zip from the staging directory's contents.
# The `(cd ...)` command ensures the files are at the root of the zip archive.
(cd "$STAGING_DIR" && zip -r9 ../"$FINAL_MODULE_NAME" .) > /dev/null
echo "  > Compressed final module."

echo "✅ Successfully packaged module: $FINAL_MODULE_NAME"

# --- Output ---
# Print the final filename to standard output so the GitHub Action can capture it.
echo "$FINAL_MODULE_NAME"
