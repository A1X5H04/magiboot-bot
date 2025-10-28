#!/bin/bash

# ==============================================================================
#
#  Boot Animation Module Packager (with Flags)
#
#  This script packages a boot animation into a flashable module, using flags
#  for metadata and generating a name-based final zip file.
#
#  It returns the final module filename as its standard output.
#
# ==============================================================================

# --- Strict Mode ---
set -eo pipefail

# FIX: Source the logger script for robust logging
# Ensure this path is correct relative to the execution directory in the workflow
if [ -f "scripts/logger.sh" ]; then
  source "scripts/logger.sh"
else
  # Fallback logger if script is not found (prints to stderr and exits)
  log_fatal() { echo "❌ FATAL: $1" >&2; exit 1; }
  log_info() { echo "INFO: $1" >&2; }
fi


# --- Helper Functions ---

# FIX: Removed redundant log_info/log_error functions.
# We will now use log_info() and log_fatal() from logger.sh

##
# Prints usage information and exits.
#
usage() {
  # FIX: Use log_fatal to ensure error is captured
  log_fatal "Usage: $0 <source_dir> <template_dir> --module-name \"Name\" --module-creator \"Creator\""
}

# --- Main Execution ---

main() {
  # --- 1. Argument Validation ---
  if [[ $# -lt 4 ]]; then
    usage
  fi

  local BOOTANIMATION_SOURCE_DIR="$1"
  local MODULE_TEMPLATE_DIR="$2"
  shift 2 # Consume the positional arguments, leaving the flags

  if [ ! -d "$BOOTANIMATION_SOURCE_DIR" ]; then
    # FIX: Use log_fatal
    log_fatal "Boot animation source directory not found at '$BOOTANIMATION_SOURCE_DIR'"
  fi
  if [ ! -d "$MODULE_TEMPLATE_DIR" ]; then
    # FIX: Use log_fatal
    log_fatal "Module template directory not found at '$MODULE_TEMPLATE_DIR'"
  fi

  # --- 2. Parse Flags ---
  local NEW_MODULE_NAME=""
  local NEW_MODULE_CREATOR=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --module-name)
        NEW_MODULE_NAME="$2"
        shift 2
        ;;
      --module-creator)
        NEW_MODULE_CREATOR="$2"
        shift 2
        ;;
      *)
        # FIX: Use log_fatal
        log_fatal "Unknown flag: $1"
        ;;
    esac
  done

  # Validate that flags were provided
  if [[ -z "$NEW_MODULE_NAME" || -z "$NEW_MODULE_CREATOR" ]]; then
    # FIX: Use log_fatal
    log_fatal "Both --module-name and --module-creator flags are required."
  fi

  # --- 3. Setup Workspace & Filename ---
  local TEMP_DIR
  TEMP_DIR=$(mktemp -d)
  trap 'rm -rf "$TEMP_DIR"' EXIT
  
  log_info "🚀 Starting module packaging process for '$NEW_MODULE_NAME'..."

  # Sanitize the module name to create a safe filename
  local SAFE_FILENAME
  SAFE_FILENAME=$(echo "$NEW_MODULE_NAME" | tr ' ' '-' | tr -dc '[:alnum:]_-')
  local FINAL_MODULE_NAME="${SAFE_FILENAME}-magiboot.zip"

  # --- 4. Create bootanimation.zip ---
  log_info "Creating bootanimation.zip with store compression (-0)..."
  local BOOTANIMATION_ZIP_PATH="$TEMP_DIR/bootanimation.zip"
  # FIX: Use log_fatal
  (cd "$BOOTANIMATION_SOURCE_DIR" && zip -0qr "$BOOTANIMATION_ZIP_PATH" .) || log_fatal "Failed to create bootanimation.zip"

  # --- 5. Assemble and Configure the Module ---
  log_info "Assembling the flashable module..."
  local STAGING_DIR="$TEMP_DIR/staging"
  mkdir -p "$STAGING_DIR"
  cp -r "$MODULE_TEMPLATE_DIR"/* "$STAGING_DIR"/
  
  log_info "Applying dynamic configuration to module.prop..."
  local MODULE_PROP_PATH="$STAGING_DIR/module.prop"
  
  if [ ! -f "$MODULE_PROP_PATH" ]; then
    # FIX: Use log_fatal
    log_fatal "The module template directory must contain a 'module.prop' file."
  fi
  
  # Combine name and creator for the 'name' field as requested
  local NEW_DESCRIPTION="A custom bootanimation module by Magiboot. Animation By: $NEW_MODULE_CREATOR."
  
  # FIX: Use a safe grep/echo pattern instead of `sed` to avoid injection errors.
  # This is far more robust.
  local TEMP_PROP
  TEMP_PROP=$(mktemp)
  
  {
    grep -v "^name=" "$MODULE_PROP_PATH"
    grep -v "^author=" "$MODULE_PROP_PATH"
    grep -v "^description=" "$MODULE_PROP_PATH"
    echo "name=$NEW_MODULE_NAME"
    echo "author=a1x5h04"
    echo "description=$NEW_DESCRIPTION"
  } > "$TEMP_PROP"
  
  mv "$TEMP_PROP" "$MODULE_PROP_PATH"

  
  # Place the bootanimation.zip into the magiboot folder.
  mkdir -p "$STAGING_DIR/common/magiboot/" # Create directory if doesn't exist.
  mv "$BOOTANIMATION_ZIP_PATH" "$STAGING_DIR/common/magiboot/bootanimation.zip"
  log_info "Added bootanimation.zip to the module."

  # --- 6. Create the Final Module Zip ---
  log_info "Compressing the final module zip..."
  # FIX: Use log_fatal
  (cd "$STAGING_DIR" && zip -r9q "../$FINAL_MODULE_NAME" .) || log_fatal "Failed to package the final module zip."
  mv "$TEMP_DIR/$FINAL_MODULE_NAME" .

  log_info "✅ Successfully packaged module: $FINAL_MODULE_NAME"

  # --- 7. Return the Final Filename ---
  echo "$FINAL_MODULE_NAME"
}

# Run the main function with all provided script arguments
main "$@"