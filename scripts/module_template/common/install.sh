# This magisk/ksu module is dynamically created by the public users using the @magibootbot, this module merely installs it onto their system.
# This bot is developed by @a1x5h04 for Magiboot, we don't encourage or own any of the videos shared by the user to make bootanimations, 
# these videos are sent by users from unknown sources, which we don't have any control of, 
# we can however remove the shared videos that are personal, or of a copyright content. 
# To remove the video and modules please reach out to us on @magibootchat and it will be taken down promptly. 
#
# NOTE: We can only remove the video/module hosted on our platform and cannot help you if the user has shared the downloaded file elsewhere.




print_header() {
  MODULE_NAME=$(get_prop name "$MODPATH/module.prop")
  MODULE_AUTHOR=$(get_prop author "$MODPATH/module.prop")
  MODULE_VERSION=$(get_prop version "$MODPATH/module.prop")
  MODULE_DESCRIPTION=$(get_prop description "$MODPATH/module.prop")


  ui_print " "
  ui_print '  ╔───────────────────────────────╗  '
  ui_print '  | ╔╦╗ ╔═╗ ╔═╗ ╦ ╔╗  ╔═╗ ╔═╗ ╔╦╗ |  '
  ui_print '  | ║║║ ╠═╣ ║ ╦ ║ ╠╩╗ ║ ║ ║ ║  ║  |  '
  ui_print '  | ╩ ╩ ╩ ╩ ╚═╝ ╩ ╚═╝ ╚═╝ ╚═╝  ╩  |  '
  ui_print '  ╚───────────────────────────────╝  '
  ui_print " "
  sleep 0.2
  ui_print " * Name: $MODULE_NAME ($MODULE_VERSION)"
  sleep 0.2
  ui_print " * $MODULE_DESCRIPTION"
  sleep 0.2
  ui_print " * By:   $MODULE_AUTHOR"
  sleep 0.2
  ui_print " "
}


install_bootanimation() {
  ui_print " "
  ui_print "- Searching for the correct bootanimation path..."
  
  #1. Define common paths where bootaniamtion can be.
  local SEARCH_PATHS="/product /system_ext /system /system/product /oem"
  local TARGET_DIR=""
  local bootanimpath="$MODPATH/common/magiboot/bootanimation.zip"

  # 2. Loop through common paths to find the original file
  for path in $SEARCH_PATHS; do
    if [ -f "$path/media/bootanimation.zip" ]; then
      TARGET_DIR="$path/media"
      ui_print "  > Found existing animation at: $TARGET_DIR"
      break
    fi
  done

  #Fallback if no paths are found.
    #   if [ -z "$TARGET_DIR" ]; then
    #     TARGET_DIR="/system/media"
    #     ui_print "  ! Could not find existing bootanimation."
    #     ui_print "  > Using default fallback path: $TARGET_DIR"
    #     ui_print " "
    #   fi

  if [ -z "$TARGET_DIR" ]; then
    ui_print " ! Looks like a unsupported ROM."
    ui_print " Report in @magibootchat"
    abort
  fi

  
  local MODULE_TARGET_PATH="$MODPATH$TARGET_DIR"

  ui_print "- Preparing module directory: $MODULE_TARGET_PATH"
  mkdir -p "$MODULE_TARGET_PATH"

  ui_print "- Copying bootanimation files..."
  
  if [ -f "$bootanimpath" ]; then
    cp_ch -n "$bootanimpath" "$MODULE_TARGET_PATH/bootanimation.zip" 0644
    ui_print "  > Copied bootanimation to path!"
  else
    ui_print "! Error: bootanimation.zip not found in module source!"
    abort
  fi
  ui_print " "
}


ui_print " "
ui_print "::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::"
ui_print " " 
print_header
ui_print " "
ui_print "::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::"
ui_print " "
sleep 0.2
ui_print " Starting installation process..."
ui_print " "
install_bootanimation
ui_print " "
ui_print " Installed Bootanimation successfully" 
ui_print " " 
ui_print " Follow @magiboot for more such animations!"
ui_print " "
ui_print " Want to create a custom animation for yourself?!"
ui_print " Just send the video in our telegram support group!"
ui_print " More info here: https://telegra.ph/Magiboot-BOT-Guide-08-11"
ui_print " "
ui_print " If any issues, ask in our group @magibootchat " 
ui_print " "

# Credits 
# THIS SCRIPT WAS HEAVILY INSPIRED BY Bootanimation modules by Cool_Modules from @jai_08