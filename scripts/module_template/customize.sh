#!/system/bin/sh
#
# Hybrid Boot Animation Installer v3
#
# Combines advanced safety features (trap cleanup) with dynamic metadata
# reading from module.prop. Works on both Magisk and KernelSU.
#

# --------------------------------------------------------------------------------
# SAFETY & PREPARATION
# --------------------------------------------------------------------------------

# This makes the script exit immediately if any command fails, preventing errors.
set -euo pipefail

# This function is called automatically by 'trap' if any error occurs.
# It ensures a failed installation doesn't leave behind a broken module.
cleanup() {
  # The $? variable holds the exit code of the last command
  if [ "$?" -ne 0 ]; then
    ui_print " "
    ui_print "*********************************************************"
    ui_print "! Installation failed. Reverting all changes..."
    # Remove the module directory to prevent a broken installation from persisting
    rm -rf "$MODPATH" 2>/dev/null
    ui_print "! System restored. No changes were made."
    ui_print "*********************************************************"
  fi
}

# The 'trap' command sets our cleanup function to run on any script error.
trap cleanup EXIT

# Override the default abort function to provide a cleaner message
abort() {
  ui_print "$1"
  # A non-zero exit code will trigger our 'trap' cleanup function
  exit 1
}

# --------------------------------------------------------------------------------
# HELPER & UI FUNCTIONS
# --------------------------------------------------------------------------------

# Standard print function
ui_print() {
  echo "$1"
}

# Function to read a property from module.prop
get_prop() {
  grep "^$1=" "$MODPATH/module.prop" | cut -d'=' -f2
}

# Header print function - now reads directly from module.prop
print_header() {
  MODULE_NAME=$(get_prop name "$MODPATH/module.prop")
  MODULE_AUTHOR=$(get_prop author "$MODPATH/module.prop")
  MODULE_VERSION=$(get_prop version "$MODPATH/module.prop")
  MODULE_DESCRIPTION=$(get_prop description "$MODPATH/module.prop")


  ui_print " "
  ui_print '   ███╗   ███╗ █████╗  ██████╗ ██╗██████╗  ██████╗  ██████╗ ████████╗
  ui_print '   ████╗ ████║██╔══██╗██╔════╝ ██║██╔══██╗██╔═══██╗██╔═══██╗╚══██╔══╝
  ui_print '   ██╔████╔██║███████║██║  ███╗██║██████╔╝██║   ██║██║   ██║   ██║   
  ui_print '   ██║╚██╔╝██║██╔══██║██║   ██║██║██╔══██╗██║   ██║██║   ██║   ██║   
  ui_print '   ██║ ╚═╝ ██║██║  ██║╚██████╔╝██║██████╔╝╚██████╔╝╚██████╔╝   ██║   
  ui_print '   ╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝╚═════╝  ╚═════╝  ╚═════╝    ╚═╝
  ui_print " "
  sleep 0.2
  ui_print " *******************************************************"
  sleep 0.2
  ui_print " * Installing: $MODULE_NAME ($MODULE_VERSION)"
  sleep 0.2
  ui_print " * By:     $MODULE_AUTHOR"
  sleep 0.2
  ui_print " * Description: $MODULE_DESCRIPTION"
  sleep 0.2
  ui_print " *******************************************************"
  ui_print " "
}

# --------------------------------------------------------------------------------
# MAIN INSTALLATION LOGIC
# --------------------------------------------------------------------------------

# --- Step 1: Initial Setup ---
# The module files are already extracted to $MODPATH by the manager app.
# We just need to set the correct permissions.
set_perm_recursive "$MODPATH" 0 0 0755 0644

# Display the header
print_header

# --- Step 2: Environment Verification ---
ui_print " [INFO] Verifying installation environment..."
if [ -n "$KPK_DEBUG" ]; then
  ROOT_SOLUTION="KernelSU"
elif [ -n "$MAGISK_VER_CODE" ]; then
  ROOT_SOLUTION="Magisk"
else
  abort "! Unsupported root solution. Requires Magisk or KernelSU."
fi
ui_print "        - Root Solution: $ROOT_SOLUTION"
ui_print "        - Android Version: $(getprop ro.build.version.release) (API $(getprop ro.build.version.sdk))"
ui_print "   [OK] Environment check passed."
ui_print " "

# --- Step 3: Module File Validation ---
ui_print " [INFO] Validating module files..."
BOOTANIMATION_SOURCE="$MODPATH/bootanimation.zip"

if [ ! -f "$BOOTANIMATION_SOURCE" ]; then
  abort "! FATAL: bootanimation.zip not found in module root."
fi

if [ ! -s "$BOOTANIMATION_SOURCE" ]; then
  abort "! FATAL: bootanimation.zip is empty."
fi
ui_print "   [OK] bootanimation.zip is present and valid."
ui_print " "

# --- Step 4: System Analysis ---
ui_print " [INFO] Analyzing system to find correct installation path..."
BOOTANIM_LOCATIONS=(
  "/product/media/bootanimation.zip"
  "/system_ext/media/bootanimation.zip"
  "/system/media/bootanimation.zip"
  "/oem/media/bootanimation.zip"
)
TARGET_PATH=""
for path in "${BOOTANIM_LOCATIONS[@]}"; do
  if [ -f "$path" ]; then
    ui_print "        - Found active bootanimation at: $path"
    TARGET_PATH="$path"
    break
  fi
done

if [ -z "$TARGET_PATH" ]; then
  ui_print "   [WARN] Could not find an existing bootanimation.zip."
  abort "   [FAIL] Installation aborted for safety."
fi
ui_print "   [OK] Target installation path set to: $TARGET_PATH"
ui_print " "

# --- Step 5: Systemless Installation ---
ui_print " [INFO] Starting systemless installation..."
TARGET_DIR_IN_MODULE="$MODPATH$(dirname "$TARGET_PATH")"

ui_print "        - Creating module directory: $(echo $TARGET_DIR_IN_MODULE | sed "s|$MODPATH|...|")"
mkdir -p "$TARGET_DIR_IN_MODULE"

ui_print "        - Copying new bootanimation.zip..."
mv "$BOOTANIMATION_SOURCE" "$MODPATH$TARGET_PATH"

ui_print "        - Setting permissions (0644)..."
set_perm "$MODPATH$TARGET_PATH" 0 0 0644
ui_print "   [OK] Installation completed successfully."
ui_print " "

# --- Final Message ---
ui_print " *******************************************************"
ui_print " * *"
ui_print " * SUCCESS! Your new boot animation is ready.          *"
ui_print " * Please reboot your device to see the changes.       *"
ui_print " * *"
ui_print " *******************************************************"
ui_print " "

# --------------------------------------------------------------------------------
# FINAL CLEANUP
# --------------------------------------------------------------------------------

# Disable the error trap so we don't trigger it on a successful exit
trap - EXIT