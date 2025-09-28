#!/system/bin/sh
#
# MagiBoot Dynamic Bootanimation Installer
#
# This script intelligently detects the root solution (Magisk or KernelSU)
# and the correct path for the bootanimation, ensuring wide compatibility.
#

# --------------------------------------------------------------------------------
# PREPARATION
# --------------------------------------------------------------------------------

# Set up environment for robustness
set -euo pipefail
ASH_STANDALONE=1

# Load module configuration
# This allows for dynamic module names, versions, etc.
if ! source "$MODPATH/config.sh"; then
  echo "! Failed to load config.sh. Installation cannot continue."
  echo "! Ensure config.sh exists in your module zip."
  exit 1
fi

# --------------------------------------------------------------------------------
# SAFETY & CLEANUP
# --------------------------------------------------------------------------------

# This function is called if any command fails, thanks to 'trap'.
# It ensures that a failed installation doesn't leave behind a broken module.
cleanup() {
  ui_print " "
  ui_print "! An error occurred. Reverting changes..."
  # Remove the module directory to prevent a broken installation
  if [ -d "$MODPATH" ]; then
    rm -rf "$MODPATH"
  fi
  ui_print "  > System restored. No changes were made."
  ui_print "! Please report this to the 'Magiboot Support group (magiboot)'."
}

# The 'trap' command sets up a cleanup action to run on script error.
trap cleanup ERR


# --------------------------------------------------------------------------------
# UI/PRINT FUNCTIONS
# --------------------------------------------------------------------------------

# A stylized print function
ui_print() {
  echo "$1"
}

# Separator line function
print_line() {
  ui_print "──────────────────────────────────────────────────"
}

# Header print function
print_header() {
  print_line
  ui_print " $MODULE_NAME"
  ui_print " By $MODULE_AUTHOR"
  ui_print " Version: $MODULE_VERSION"
  print_line
  ui_print " "
}


# --------------------------------------------------------------------------------
# MAIN INSTALLATION LOGIC
# --------------------------------------------------------------------------------

# Let's begin!
print_header

# --- Step 1: Verify Bootanimation File ---
ui_print "- Verifying bootanimation file..."
if [ ! -f "$ZIPFILE/bootanimation.zip" ]; then
  ui_print "! ERROR: Bootanimation file not found!"
  ui_print "! The file 'bootanimation.zip' does not exist"
  ui_print "! in the module zip."
  exit 1 # Abort installation (will trigger cleanup)
fi
ui_print "  > Found: bootanimation.zip"
ui_print " "

# --- Step 2: Detect Root Solution ---
ui_print "- Detecting root environment..."
if [ -n "${KSU}" ] && [ -d "/data/adb/ksu" ]; then
  ROOT_TYPE="KernelSU"
elif [ -n "${MAGISKTMP}" ]; then
  ROOT_TYPE="Magisk"
else
  ui_print "! ERROR: Unsupported root solution."
  ui_print "! This module requires Magisk or KernelSU."
  ui_print "! Please report this to the 'Magiboot Support group (magiboot)'."
  exit 1 # Abort installation
fi
ui_print "  > Detected: $ROOT_TYPE"
ui_print " "

# --- Step 3: Find Target Bootanimation Path ---
ui_print "- Locating system bootanimation..."
# List of common paths, ordered by priority
# We search for an existing bootanimation.zip to determine the correct location.
SEARCH_PATHS="/product /system_ext /system /oem"
TARGET_DIR=""

for path in $SEARCH_PATHS; do
  if [ -f "$path/media/bootanimation.zip" ]; then
    TARGET_DIR="$path/media"
    ui_print "  > Found at: $TARGET_DIR"
    break
  fi
done

if [ -z "$TARGET_DIR" ]; then
  # If no existing file is found, we fall back to the most common path.
  TARGET_DIR="/system/media"
  ui_print "  ! Could not find existing bootanimation."
  ui_print "  > Using fallback path: $TARGET_DIR"
fi
ui_print " "

# --- Step 4: Set up Module Directory ---
ui_print "- Preparing module installation directory..."
# The module will place the new bootanimation at the path we just found.
MODULE_TARGET_PATH="$MODPATH$TARGET_DIR"
mkdir -p "$MODULE_TARGET_PATH"
ui_print "  > Module files will be placed in:"
ui_print "    $MODULE_TARGET_PATH"
ui_print " "

# --- Step 5: Install Bootanimation ---
ui_print "- Installing new bootanimation..."
# This is our safe trigger. If the bootanimation file from the config doesn't
# exist in the zip, the script will fail here thanks to `set -e`.
unzip -o "$ZIPFILE/bootanimation.zip" -d "$TMPDIR/bootanimation_extracted" >/dev/null 2>&1
# We rename the user's file to the standard 'bootanimation.zip'
mv "$TMPDIR/bootanimation_extracted"/* "$MODULE_TARGET_PATH/" # This is a trick to handle nested zips
cp -r "$TMPDIR/bootanimation_extracted/"* "$MODULE_TARGET_PATH/"
if [ -f "$MODULE_TARGET_PATH/bootanimation.zip" ]; then
    mv "$MODULE_TARGET_PATH/bootanimation.zip" "$MODULE_TARGET_PATH/bootanimation.zip"
else # Handle cases where the zip extracts to a folder
    # Find the desc.txt file to locate the root of the animation files
    ANIM_ROOT=$(find "$MODULE_TARGET_PATH" -name "desc.txt" -exec dirname {} \;)
    if [ -n "$ANIM_ROOT" ] && [ "$ANIM_ROOT" != "$MODULE_TARGET_PATH" ]; then
        # Files are in a subdirectory, let's zip them up correctly
        ui_print "  > Repackaging nested bootanimation..."
        (cd "$ANIM_ROOT" && zip -r0 "$MODULE_TARGET_PATH/bootanimation.zip" ./*) >/dev/null 2>&1
        rm -rf "$ANIM_ROOT"
    fi
fi

# The final destination file
FINAL_FILE="$MODULE_TARGET_PATH/bootanimation.zip"

if [ -f "$FINAL_FILE" ]; then
    ui_print "  > Successfully installed."
else
    ui_print "! ERROR: Failed to install bootanimation file."
    ui_print "! The zip may be structured incorrectly or is empty."
    exit 1
fi
ui_print " "

# Set correct permissions
ui_print "- Setting permissions..."
set_perm_recursive "$MODPATH" 0 0 0755 0644
ui_print "  > Permissions set."
ui_print " "

# --- Step 6: Finalizing ---
ui_print "- Finalizing module..."
# The module.prop is created dynamically from the config.sh variables
# This makes it easy to manage different versions from one place.
cat > "$MODPATH/module.prop" <<EOF
id=$MODULE_ID
name=$MODULE_NAME
version=$MODULE_VERSION
versionCode=$MODULE_VERSION_CODE
author=$MODULE_AUTHOR
description=$MODULE_DESC
EOF
ui_print "  > module.prop created."
ui_print " "

# --- All Done! ---
# Disable the error trap so we don't trigger it on a successful exit
trap - ERR
print_line
ui_print " Installation successful!"
ui_print " Reboot your device to see your new bootanimation."
print_line

