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

# --- Helper Functions ---

##
# Logs an informational message to stderr.
#
log_info() {
  echo "INFO: $1" >&2
}

##
# Logs an error message to stderr and exits with a non-zero status.
#
log_error() {
  echo "❌ ERROR: $1" >&2
  exit 1
}

##
# Prints usage information and exits.
#
usage() {
  log_error "Usage: $0 <source_dir> <template_dir> --module-name \"Name\" --module-creator \"Creator\""
  exit 1
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
    log_error "Boot animation source directory not found at '$BOOTANIMATION_SOURCE_DIR'"
  fi
  if [ ! -d "$MODULE_TEMPLATE_DIR" ]; then
    log_error "Module template directory not found at '$MODULE_TEMPLATE_DIR'"
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
        log_error "Unknown flag: $1"
        usage
        ;;
    esac
  done

  # Validate that flags were provided
  if [[ -z "$NEW_MODULE_NAME" || -z "$NEW_MODULE_CREATOR" ]]; then
    log_error "Both --module-name and --module-creator flags are required."
    usage
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
  (cd "$BOOTANIMATION_SOURCE_DIR" && zip -0qr "$BOOTANIMATION_ZIP_PATH" .) || log_error "Failed to create bootanimation.zip"

  # --- 5. Assemble and Configure the Module ---
  log_info "Assembling the flashable module..."
  local STAGING_DIR="$TEMP_DIR/staging"
  mkdir -p "$STAGING_DIR"
  cp "$MODULE_TEMPLATE_DIR"/* "$STAGING_DIR"/
  
   log_info "Applying dynamic configuration to module.prop..."
  local MODULE_PROP_PATH="$STAGING_DIR/module.prop"
  
  if [ ! -f "$MODULE_PROP_PATH" ]; then
    log_error "The module template directory must contain a 'module.prop' file."
  fi
  
  # Combine name and creator for the 'name' field as requested
  local NEW_DESCRIPTION="A custom bootanimation module by Magiboot. Animation By: $NEW_MODULE_CREATOR."
  
  # Update the module.prop file using sed
  # Using '|' as a separator for sed to handle special characters in names
  sed -i "s|^name=.*|name=$NEW_MODULE_NAME|" "$MODULE_PROP_PATH"
  sed -i "s|^author=.*|author=a1x5h04|" "$MODULE_PROP_PATH"
  sed -i "s|^description=.*|description=$NEW_DESCRIPTION|" "$MODULE_PROP_PATH"
  
  # Place the bootanimation.zip into the module's root
  mv "$BOOTANIMATION_ZIP_PATH" "$STAGING_DIR/bootanimation.zip"
  log_info "Added bootanimation.zip to the module."

  # --- 6. Create the Final Module Zip ---
  log_info "Compressing the final module zip..."
  (cd "$STAGING_DIR" && zip -r9q "../$FINAL_MODULE_NAME" .) || log_error "Failed to package the final module zip."
  mv "$TEMP_DIR/$FINAL_MODULE_NAME" .

  log_info "✅ Successfully packaged module: $FINAL_MODULE_NAME"

  # --- 7. Return the Final Filename ---
  echo "$FINAL_MODULE_NAME"
}

# Run the main function with all provided script arguments
main "$@"