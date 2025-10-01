#!/bin/bash

# ==============================================================================
#
#  Boot Animation Preparer (Functional Version)
#
#  This script prepares a video file's frames for a boot animation. It operates
#  like a function: it takes a video file as input and returns the path to a
#  new temporary directory containing the prepared animation assets.
#
#  Usage:
#    ./prepare_boot_animation.sh /path/to/video.mp4
#
#  On success, it prints the path of the output directory (e.g., /tmp/tmp.XXXXXX)
#  to standard output. This directory contains the 'part0' folder and 'desc.txt',
#  ready to be zipped.
#
#  All informational and error messages are printed to standard error.
#
# ==============================================================================

# --- Configuration ---
TARGET_RESOLUTION="1080:1920" # Target Portrait 1080p resolution
MAX_DURATION=25               # Max video duration in seconds
MAX_WIDTH=3840                # Max video width (4K)
MAX_FPS=60                    # Max video framerate
MAX_SIZE_MB=20                # Max video size in MB

# --- Strict Mode & Error Handling ---
# -e: exit on error
# -u: exit on unset variables
# -o pipefail: exit if any command in a pipeline fails
set -euo pipefail

# --- Helper Functions ---
# All logs go to stderr to keep stdout clean for the final output path.
log_info() {
  echo "INFO: $1" >&2
}

log_error() {
  echo "ERROR: $1" >&2
  exit 1
}

# --- Core Logic Functions ---

##
# Checks for required system dependencies (ffmpeg, ffprobe, awk).
##
check_dependencies() {
  log_info "Checking for dependencies..."
  command -v ffmpeg >/dev/null 2>&1 || log_error "ffmpeg is not installed. Please install it."
  command -v ffprobe >/dev/null 2>&1 || log_error "ffprobe is not installed. Please install it."
  command -v awk >/dev/null 2>&1 || log_error "awk is not installed. It is required for calculations."
}

##
# Analyzes the input video, validates it against configured limits,
# and returns its properties as a space-separated string.
#
# @param $1 Path to the input video file.
# @return A string "FPS TARGET_WIDTH TARGET_HEIGHT DURATION FORMAT RESOLUTION" on success.
##
validate_and_get_properties() {
  local input_video="$1"
  log_info "Analyzing and validating '$input_video'..."
  if [ ! -f "$input_video" ]; then
    log_error "Input video '$input_video' not found!"
  fi

  # Read all properties in one efficient ffprobe call
  local width height fps_fraction duration size_bytes format
  {
    read -r width
    read -r height
    read -r fps_fraction
    read -r duration
    read -r size_bytes
    read -r format
  } < <(ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height,r_frame_rate,duration \
    -show_entries format=size,format_name \
    -of default=nw=1:nk=1 "$input_video")

  # --- Validation ---
  log_info "Validating against limits"
  local size_mb 
  size_mb=$(awk -v size="$size_bytes" 'BEGIN { printf "%.0f", size / 1024 / 1024 }')
  if [ "$size_mb" -gt "$MAX_SIZE_MB" ]; then
    log_error "Validation failed: Video size ($size_mb MB) exceeds the maximum of $MAX_SIZE_MB MB."
  fi

  if (( $(awk -v dur="$duration" 'BEGIN { print (dur > '$MAX_DURATION') }') )); then
    log_error "Validation failed: Video duration ($duration s) exceeds the maximum of $MAX_DURATION s."
  fi

  if [ "$width" -gt "$MAX_WIDTH" ]; then
    log_error "Validation failed: Video width ($width px) exceeds the maximum of $MAX_WIDTH px (4K)."
  fi

  local fps_value
  fps_value=$(awk -F/ '{print $1 / $2}' <<< "$fps_fraction")
  if (( $(awk -v fps="$fps_value" 'BEGIN { print (fps > '$MAX_FPS') }') )); then
    log_error "Validation failed: Video framerate ($fps_value FPS) exceeds the maximum of $MAX_FPS FPS."
  fi

  # Prepare properties for return
  local fps target_width target_height resolution
  fps=$(printf "%.0f" "$fps_value")
  target_width=$(echo "$TARGET_RESOLUTION" | cut -d':' -f1)
  target_height=$(echo "$TARGET_RESOLUTION" | cut -d':' -f2)
  # Correctly format the original video resolution string
  resolution="${width}x${height}"

  log_info "Validation passed. Duration=$duration, FPS=$fps, Resolution=${resolution}, Format=$format."
    
  # Return values by printing them to stdout for the calling function to capture
  echo "$fps $target_width $target_height $duration $format $resolution"
}

##
# Extracts all frames from the video into the specified output directory.
#
# @param $1 Path to the input video file.
# @param $2 Path to the output directory.
##
extract_frames() {
  local input_video="$1"
  local output_dir="$2"
  
  log_info "Extracting all frames into a single part..."
  local part_dir="$output_dir/part0"
  mkdir -p "$part_dir"

  ffmpeg -v error -hwaccel auto -i "$input_video" \
         -vf "scale=$TARGET_RESOLUTION,setsar=1,format=yuvj420p" \
         -q:v 2 \
         -an \
         -y \
         "$part_dir/%05d.jpg"
  
  log_info "Frame extraction complete."
}

##
# Creates a simple desc.txt file for a single, infinitely looping part.
#
# @param $1 Path to the output directory.
# @param $2 Target width.
# @param $3 Target height.
# @param $4 Frames per second (FPS).
##
create_desc_txt() {
  local output_dir="$1"
  local target_width="$2"
  local target_height="$3"
  local fps="$4"

  log_info "Creating desc.txt for a single looping part..."
  local desc_file="$output_dir/desc.txt"

  # Line 1: Width Height FPS
  echo "$target_width $target_height $fps" > "$desc_file"
  
  # Line 2: Part configuration (p -> play, 0 -> loop forever, 0 -> no pause, part0 -> folder)
  echo "p 0 0 part0" >> "$desc_file"

  log_info "desc.txt created successfully."
}

# --- Main Execution Function ---
main() {
  if [[ -z "${1-}" ]]; then
    log_error "Usage: $0 <input_video_file>"
  fi
  local input_video="$1"

  check_dependencies

  # Create a secure temporary directory for the output. This is the only
  # "side effect" and its path is the script's return value.
  local output_dir
  output_dir=$(mktemp -d)

  # Validate video and capture its properties into local variables
  local properties_string
  properties_string=$(validate_and_get_properties "$input_video")
  local fps target_width target_height duration format resolution
  read -r fps target_width target_height duration format resolution <<< "$properties_string"

  extract_frames "$input_video" "$output_dir"
  create_desc_txt "$output_dir" "$target_width" "$target_height" "$fps"

  log_info "✅ All done! The prepared assets are in '$output_dir'."
  log_info "This path is now being printed to standard output."

  # The final "return value" of the script.
  cat <<EOF
boot_output_dir=$output_dir
boot_video_duration=$duration
boot_video_fps=$fps
boot_video_resolution=$resolution
boot_video_format=$format
boot_bootanimation_resolution=${target_width}x${target_height}
boot_bootanimation_fps=$fps
boot_bootanimation_module_type=single-part
EOF
}

# --- Script Entry Point ---
# This construct ensures that the main function is called only when the script
# is executed directly, not when it's sourced.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
