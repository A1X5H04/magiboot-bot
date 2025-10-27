#!/bin/bash

# ==============================================================================
#
#  Boot Animation Preparer
#
#  This script prepares a video file's frames for a boot animation. It reads
#  configuration data from the 'METADATA_JSON' environment variable.
#
# ==============================================================================

# --- Configuration ---
MAX_DURATION=25
MAX_WIDTH=3840
MAX_FPS=60
MAX_SIZE_MB=20

# --- Strict Mode & Error Handling ---
set -euo pipefail

# --- Logger ---
source scripts/logger.sh

# --- Core Logic Functions ---

check_dependencies() {
  log_info "Checking dependencies: ffmpeg, ffprobe, awk, jq, seq, xargs..."
  command -v ffmpeg >/dev/null 2>&1 || log_fatal "ffmpeg is not installed. Please install it."
  command -v ffprobe >/dev/null 2>&1 || log_fatal "ffprobe is not installed. Please install it."
  command -v awk >/dev/null 2>&1 || log_fatal "awk is not installed. It is required for calculations."
  command -v jq >/dev/null 2>&1 || log_fatal "jq is not installed. It is required for JSON parsing."
  command -v seq >/dev/null 2>&1 || log_fatal "seq is not installed (part of coreutils). It is required for file moving."
  command -v xargs >/dev/null 2>&1 || log_fatal "xargs is not installed (part of coreutils). It is required for file moving."
}

validate_and_get_properties() {
  local input_video="$1"
  log_info "Analyzing and validating '$input_video'..."
  if [ ! -f "$input_video" ]; then
    log_fatal "Input video '$input_video' not found!"
  fi

  local json_output
  json_output=$(ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height,r_frame_rate \
    -show_entries format=duration,size,format_name \
    -of json "$input_video")

  # Use jq to parse the JSON. Use '// "N/A"' to provide a default
  # value if a key is missing or null, which prevents read errors.
  local width height fps_fraction duration size_bytes format
  {
    read -r width
    read -r height
    read -r fps_fraction
    read -r duration
    read -r size_bytes
    read -r format
  } < <(echo "$json_output" | jq -r '
      .streams[0].width // "N/A",
      .streams[0].height // "N/A",
      .streams[0].r_frame_rate // "N/A",
      .format.duration // "N/A",
      .format.size // "N/A",
      .format.format_name // "N/A"
  ')

  # --- Robustness Checks ---
  if [ -z "$width" ] || [[ "$width" == "N/A" ]] || [ -z "$height" ] || [[ "$height" == "N/A" ]]; then
    log_fatal "Validation failed: Could not retrieve video resolution (width/height). Is this a valid video file?"
  fi
  if [ -z "$fps_fraction" ] || [[ "$fps_fraction" == "0/0" ]] || [[ "$fps_fraction" == "N/A" ]]; then
    log_fatal "Validation failed: Could not retrieve video frame rate (r_frame_rate)."
  fi
  if [ -z "$duration" ] || [[ "$duration" == "N/A" ]]; then
    log_fatal "Validation failed: Could not retrieve video duration."
  fi
  if [ -z "$size_bytes" ] || [[ "$size_bytes" == "N/A" ]]; then
    log_fatal "Validation failed: Could not retrieve file size."
  fi

  log_info "Validating against limits"
  local size_mb 
  size_mb=$(awk -v size="$size_bytes" 'BEGIN { printf "%.0f", size / 1024 / 1024 }')
  if [ "$size_mb" -gt "$MAX_SIZE_MB" ]; then
    log_fatal "Validation failed: Video size ($size_mb MB) exceeds the maximum of $MAX_SIZE_MB MB."
  fi

  if (( $(awk -v dur="$duration" 'BEGIN { print (dur > '$MAX_DURATION') }') )); then
    log_fatal "Validation failed: Video duration ($duration s) exceeds the maximum of $MAX_DURATION s."
  fi

  if [ "$width" -gt "$MAX_WIDTH" ]; then
    log_fatal "Validation failed: Video width ($width px) exceeds the maximum of $MAX_WIDTH px (4K)."
  fi

  local fps_value
  fps_value=$(awk -F/ '{print $1 / $2}' <<< "$fps_fraction")
  if (( $(awk -v fps="$fps_value" 'BEGIN { print (fps > '$MAX_FPS') }') )); then
    log_fatal "Validation failed: Video framerate ($fps_value FPS) exceeds the maximum of $MAX_FPS FPS."
  fi

  local fps target_width target_height resolution
  fps=$(printf "%.0f" "$fps_value")
  target_width='1080'
  target_height='1920'
  resolution="${width}x${height}"

  log_info "Validation passed. Duration=$duration, FPS=$fps, Resolution=${resolution}, Format=$format."
  echo "$fps $target_width $target_height $duration $format $resolution"
}


extract_all_frames() {
  local input_video="$1"
  local all_frames_dir="$2"
  
  log_info "Extracting all frames into '$all_frames_dir'..."
  mkdir -p "$all_frames_dir"

  # -vsync 0 ensures frames are numbered sequentially
  ffmpeg -v error -hwaccel auto -i "$input_video" \
         -vf "scale=720:-1,setsar=1,format=yuvj420p" \
         -q:v 2 \
         -an \
         -y \
         -vsync 0 \
         "$all_frames_dir/%05d.jpg"
  
  log_info "Full frame extraction complete."
}


# Creates a simple desc.txt file for a single, infinitely looping part.
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


# Process Multi part Config 
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
  
  echo "$target_width $target_height $video_fps" > "$desc_file"

  local last_frame_end=0 
  local part_index=0
  local last_unit="" 

  while read -r part_config; do
    local part_name="part$part_index"
    local part_dir="$output_dir/$part_name"
    
    local time_val unit type count pause
    time_val=$(echo "$part_config" | jq -r '.timeframe.value')
    unit=$(echo "$part_config" | jq -r '.timeframe.unit')
    type=$(echo "$part_config" | jq -r '.type')
    count=$(echo "$part_config" | jq -r '.count')
    pause=$(echo "$part_config" | jq -r '.pause')

    local current_part_frame_end=0


    if [ "$unit" == "seconds" ]; then
      current_part_frame_end=$(awk -v time="$time_val" -v fps="$video_fps" 'BEGIN { printf "%.0f", time * fps }')
    elif [ "$unit" == "frames" ]; then
      current_part_frame_end=$(printf "%.0f" "$time_val")
    elif [ "$unit" == "end" ]; then
      current_part_frame_end=$video_total_frames
    else
      log_fatal "Invalid 'unit' in config: $unit"
    fi


    if [ "$current_part_frame_end" -lt "$last_frame_end" ]; then
       log_fatal "Validation failed: Part $part_index end frame ($current_part_frame_end) is before the previous part's end frame ($last_frame_end)."
    fi
    
    if [ "$current_part_frame_end" -gt "$video_total_frames" ]; then
        if [ "$unit" != "end" ]; then
            log_warn "Part $part_index end ($current_part_frame_end frames) exceeds video duration. Capping at $video_total_frames frames."
        fi
        current_part_frame_end=$video_total_frames
    fi

    local frame_start_move=$((last_frame_end + 1))
    local frame_end_move=$current_part_frame_end

    mkdir -p "$part_dir"
    if [ "$frame_start_move" -le "$frame_end_move" ]; then
        log_info "Moving frames $frame_start_move to $frame_end_move to '$part_name'..."
        seq -f "$all_frames_dir/%05g.jpg" "$frame_start_move" "$frame_end_move" | xargs mv -t "$part_dir/"
    else
        log_info "Skipping part '$part_name': No frames in range ($frame_start_move > $frame_end_move)."
    fi

    echo "$type $count $pause $part_name" >> "$desc_file"

    last_frame_end=$current_part_frame_end
    part_index=$((part_index + 1))
    last_unit=$unit

  done < <(echo "$config_json" | jq -c '.[]')

  
  # Handle partial config
  if [ "$last_unit" != "end" ] && [ "$last_frame_end" -lt "$video_total_frames" ]; then
    log_info "Partial config detected. Adding a final looping part for remaining frames."
    local part_name="part$part_index"
    local part_dir="$output_dir/$part_name"
    mkdir -p "$part_dir"

    local frame_start_move=$((last_frame_end + 1))
    local frame_end_move=$video_total_frames

    if [ "$frame_start_move" -le "$frame_end_move" ]; then
        log_info "Moving remaining frames $frame_start_move to $frame_end_move to '$part_name'..."
        seq -f "$all_frames_dir/%05g.jpg" "$frame_start_move" "$frame_end_move" | xargs mv -t "$part_dir/"
    else
        log_info "No remaining frames to add to final part ($frame_start_move > $frame_end_move)."
    fi

    echo "p 0 0 $part_name" >> "$desc_file"
  
  elif [ "$last_unit" != "end" ] && [ "$last_frame_end" -ge "$video_total_frames" ]; then
      log_info "Config parts cover the full video duration. No final part needed."
  elif [ "$last_unit" == "end" ]; then
      log_info "Config already ends with 'end' unit. No final part needed."
  fi

  log_info "Multi-part desc.txt created successfully."
}


main() {
  if [[ -z "${1-}" ]]; then
    log_fatal "Usage: $0 <input_video_file>"
  fi
  local input_video="$1"

  export INTERNAL_DEBUG_LOG="/workdir/build_log.jsonl"
  export USER_ERROR_LOG="/workdir/user_errors.log"

  check_dependencies

  local output_dir="bootanimation-output"
  mkdir -p "$output_dir"

  local properties_string
  properties_string=$(validate_and_get_properties "$input_video")
  local fps target_width target_height duration format resolution
  read -r fps target_width target_height duration format resolution <<< "$properties_string"

  # This calculation is the total *count* of frames, which now also
  # matches the *index* of the last frame (e.g., 361 frames = 00361.jpg)
  log_info "Counting actual extracted frames..."
  local total_frames
  total_frames=$(ls -1q "$all_frames_dir" | wc -l)

  if [ "$total_frames" -eq 0 ]; then
      log_fatal "FFmpeg extracted 0 frames. The video file might be corrupt or empty."
  fi
  log_info "Counted $total_frames total frames."
  
  local all_frames_dir="$output_dir/all-frames-temp"
  extract_all_frames "$input_video" "$all_frames_dir"

  local module_type="single-part"
  local boot_config_json
  
  boot_config_json=$(echo "${METADATA_JSON:-'{}'}" | jq -c '.bootanim_config // null')

  if [ -z "$boot_config_json" ] || [ "$boot_config_json" == "null" ] || [ "$boot_config_json" == "[]" ]; then
    log_info "No 'bootanim_config' found. Using default single-part logic."
    
    local part0_dir="$output_dir/part0"
    mkdir -p "$part0_dir"
    log_info "Moving all frames to 'part0'..."
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

  rmdir "$all_frames_dir"

  log_info "✅ All done! The prepared assets are in '$output_dir'."
  log_info "This path is now being printed to standard output."

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