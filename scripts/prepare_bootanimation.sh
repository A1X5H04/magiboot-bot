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
  echo "::error::$1" >&2
  exit 1
}

# --- Core Logic Functions ---
check_dependencies() {
  log_info "Checking for dependencies..."
  command -v ffmpeg >/dev/null 2>&1 || log_error "ffmpeg is not installed. Please install it."
  command -v ffprobe >/dev/null 2>&1 || log_error "ffprobe is not installed. Please install it."
  command -v awk >/dev/null 2>&1 || log_error "awk is not installed. It is required for calculations."
  command -v jq >/dev/null 2>&1 || log_error "jq is not installed. It is required for JSON parsing."
  command -v seq >/dev/null 2>&1 || log_error "seq is not installed (part of coreutils). It is required for file moving."
  command -v xargs >/dev/null 2>&1 || log_error "xargs is not installed (part of coreutils). It is required for file moving."
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
  target_width='1080'
  target_height='1920'
  resolution="${width}x${height}"

  log_info "Validation passed. Duration=$duration, FPS=$fps, Resolution=${resolution}, Format=$format."
  echo "$fps $target_width $target_height $duration $format $resolution"
}

##
# Extracts ALL frames from the video into a single temp directory.
#
# @param $1 Path to the input video file.
# @param $2 Path to the temporary output directory for all frames.
##
extract_all_frames() {
  local input_video="$1"
  local all_frames_dir="$2"
  
  log_info "Extracting all frames into '$all_frames_dir'..."
  mkdir -p "$all_frames_dir"

  # -vsync 0 ensures frames are numbered sequentially starting from 0
  ffmpeg -v error -hwaccel auto -i "$input_video" \
         -vf "scale=720:-1,setsar=1,format=yuvj420p" \
         -q:v 2 \
         -an \
         -y \
         -vsync 0 \
         "$all_frames_dir/%05d.jpg"
  
  log_info "Full frame extraction complete."
}

##
# Creates a simple desc.txt file for a single, infinitely looping part.
#
# @param $1 Path to the output directory.
# @param $2 Target width.
# @param $3 Target height.
# @param $4 Frames per second (FPS).
##
create_single_part_desc_txt() {
  local output_dir="$1"
  local target_width="$2"
  local target_height="$3"
  local fps="$4"

  log_info "Creating desc.txt for a single looping part..."
  local desc_file="$output_dir/desc.txt"

  echo "$target_width $target_height $fps" > "$desc_file"
  echo "p 0 0 part0" >> "$desc_file"

  log_info "desc.txt created successfully."
}


##
# Validates, MOVES frames, and builds a multi-part boot animation.
#
# @param $1 Path to the temp directory holding all frames
# @param $2 Root output directory path
# @param $3 bootanim_config JSON string
# @param $4 Video FPS
# @param $5 Video total frames
# @param $6 Target width
# @param $7 Target height
##
process_multi_part_config() {
  local all_frames_dir="$1"
  local output_dir="$2"
  local config_json="$3"
  local video_fps="$4"
  local video_total_frames="$5"
  local target_width="$6"
  local target_height="$7"

  local desc_file="$output_dir/desc.txt"
  log_info "Creating multi-part desc.txt at '$desc_file'..."
  
  # Write header: Width Height FPS
  echo "$target_width $target_height $video_fps" > "$desc_file"

  local last_frame_end=0
  local part_index=0

  # Loop through each object in the JSON array using jq
  echo "$config_json" | jq -c '.[]' | while read -r part_config; do
    local part_name="part$part_index"
    local part_dir="$output_dir/$part_name"
    
    # Parse config for this part
    local time_val unit type count pause
    time_val=$(echo "$part_config" | jq -r '.timeframe.value')
    unit=$(echo "$part_config" | jq -r '.timeframe.unit')
    type=$(echo "$part_config" | jq -r '.type')
    count=$(echo "$part_config" | jq -r '.count')
    pause=$(echo "$part_config" | jq -r '.pause')

    local current_part_frame_end=0

    # --- 1. Calculate Frame Range ---
    if [ "$unit" == "seconds" ]; then
      current_part_frame_end=$(awk -v time="$time_val" -v fps="$video_fps" 'BEGIN { printf "%.0f", time * fps }')
    elif [ "$unit" == "frames" ]; then
      current_part_frame_end=$(printf "%.0f" "$time_val")
    elif [ "$unit" == "end" ]; then
      current_part_frame_end=$video_total_frames
    else
      log_error "Invalid 'unit' in config: $unit"
    fi

    # --- 2. Validation ---
    if [ "$current_part_frame_end" -lt "$last_frame_end" ]; then
       log_error "Validation failed: Part $part_index end time/frame ($current_part_frame_end) is before the previous part's end time/frame ($last_frame_end)."
    fi
    if [ "$unit" != "end" ] && [ "$current_part_frame_end" -gt "$video_total_frames" ]; then
      log_error "Validation failed: Part $part_index end ($current_part_frame_end frames) exceeds video duration ($video_total_frames frames)."
    fi
    if [ "$current_part_frame_end" -gt "$video_total_frames" ]; then
        current_part_frame_end=$video_total_frames
    fi

    # --- 3. Calculate FFMPEG frame range (inclusive, 0-indexed) ---
    local frame_start_move=$last_frame_end
    local frame_end_move=$((current_part_frame_end - 1))

    # --- 4. Move Frames ---
    mkdir -p "$part_dir"
    if [ "$frame_start_move" -le "$frame_end_move" ]; then
        log_info "Moving frames $frame_start_move to $frame_end_move to '$part_name'..."
        # Use seq to generate filenames and pipe to xargs for efficient mv
        # -f generates formatted strings, %05g is 5-digit padding
        # xargs mv -t "$part_dir/" moves all files from stdin into the target dir
        seq -f "$all_frames_dir/%05g.jpg" "$frame_start_move" "$frame_end_move" | xargs mv -t "$part_dir/"
    else
        log_info "Skipping part '$part_name': No frames in range ($frame_start_move > $frame_end_move)."
    fi

    # --- 5. Append to desc.txt ---
    echo "$type $count $pause $part_name" >> "$desc_file"

    # --- 6. Update counters for next loop ---
    last_frame_end=$current_part_frame_end
    part_index=$((part_index + 1))
  done
  
  log_info "Multi-part desc.txt created successfully."
}

# --- Main Execution Function ---
main() {
  if [[ -z "${1-}" ]]; then
    log_error "Usage: $0 <input_video_file>"
  fi
  local input_video="$1"

  check_dependencies

  local output_dir="bootanimation-output"
  mkdir -p "$output_dir"

  # Validate video and capture its properties
  local properties_string
  properties_string=$(validate_and_get_properties "$input_video")
  local fps target_width target_height duration format resolution
  read -r fps target_width target_height duration format resolution <<< "$properties_string"

  # Calculate total frames (e.g., 10s * 30fps = 300 frames, numbered 0-299)
  local total_frames
  total_frames=$(awk -v dur="$duration" -v fps="$fps" 'BEGIN { printf "%.0f", dur * fps }')
  
  # --- NEW: Extract ALL frames first ---
  local all_frames_dir="$output_dir/all-frames-temp"
  extract_all_frames "$input_video" "$all_frames_dir"

  local module_type="single-part" # Default module type
  local boot_config_json
  boot_config_json=$(echo "${METADATA_JSON:-'{}'}" | jq -c '.bootanim_config // null')

  if [ -z "$boot_config_json" ] || [ "$boot_config_json" == "null" ] || [ "$boot_config_json" == "[]" ]; then
    log_info "No 'bootanim_config' found. Using default single-part logic."
    
    # --- MODIFIED: Move all frames to part0 ---
    local part0_dir="$output_dir/part0"
    mkdir -p "$part0_dir"
    log_info "Moving all frames to 'part0'..."
    # Check if files exist before moving to avoid error on 0-frame video
    if [ -n "$(ls -A "$all_frames_dir"/*.jpg 2>/dev/null)" ]; then
        mv "$all_frames_dir"/*.jpg "$part0_dir/"
    else
        log_info "No frames were extracted."
    fi

    create_single_part_desc_txt "$output_dir" "$target_width" "$target_height" "$fps"
    
  else
    log_info "Found 'bootanim_config'. Processing multi-part animation..."
    module_type="multi-part"
    
    process_multi_part_config \
      "$all_frames_dir" \
      "$output_dir" \
      "$boot_config_json" \
      "$fps" \
      "$total_frames" \
      "$target_width" \
      "$target_height"
  fi

  # --- NEW: Cleanup ---
  rmdir "$all_frames_dir"
  log_info "Cleaned up temporary frame directory."

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
boot_bootanimation_module_type=$module_type
EOF
}

# --- Script Entry Point ---
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
