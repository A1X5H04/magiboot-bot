#!/bin/bash

# ==============================================================================
#
#  Video to Boot Animation Converter
#
#  This script transforms a video file into a compliant bootanimation.zip.
#  It validates the source video, uses a frame-count limit to dynamically
#  create parts, and ensures compatibility and smoothness without extra
#  dependencies like 'bc'.
#
# ==============================================================================

# --- Configuration ---
INPUT_VIDEO="video.mp4"
OUTPUT_DIR="output"
TARGET_RESOLUTION="1080:1920" # Target Portrait 1080p resolution
MAX_FRAMES_PER_PART=350       # Max frames allowed in a single 'part' folder
MAX_PARTS=5                   # Absolute maximum number of part folders to create
MAX_DURATION=20               # Max video duration in seconds
MAX_WIDTH=3840                # Max video width (4K)
MAX_FPS=60                    # Max video framerate
MAX_SIZE_MB=25                # Max video size in MB

# --- Strict Mode & Error Handling ---
set -e

# --- Helper Functions ---
log_info() {
  echo "INFO: $1"
}

log_error() {
  echo "ERROR: $1" >&2
  exit 1
}

# --- Dependency Check ---
command -v ffmpeg >/dev/null 2>&1 || log_error "ffmpeg is not installed. Please install it to continue."
command -v ffprobe >/dev/null 2>&1 || log_error "ffprobe is not installed. Please install it to continue."
command -v awk >/dev/null 2>&1 || log_error "awk is not installed. It is required for calculations."

# --- Main Script Logic ---

log_info "Starting boot animation creation process for '$INPUT_VIDEO'."

# 1. Clean up previous runs
log_info "Cleaning up old directories..."
rm -rf "$OUTPUT_DIR" bootanimation.zip
mkdir -p "$OUTPUT_DIR"

# 2. Get Video Properties & Run Pre-flight Checks
log_info "Analyzing video properties and running pre-flight checks..."
if [ ! -f "$INPUT_VIDEO" ]; then
  log_error "Input video '$INPUT_VIDEO' not found!"
fi

# Read all properties in one efficient ffprobe call
{
  read -r WIDTH
  read -r FPS_FRACTION
  read -r DURATION
  read -r SIZE_BYTES
} < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,r_frame_rate,duration -show_entries format=size -of default=nw=1:nk=1 "$INPUT_VIDEO")

# --- Validation ---
log_info "Validating video against limits (Size: ${MAX_SIZE_MB}MB, Duration: ${MAX_DURATION}s, FPS: ${MAX_FPS}, Width: ${MAX_WIDTH}px)..."
SIZE_MB=$(awk -v size="$SIZE_BYTES" 'BEGIN { printf "%.0f", size / 1024 / 1024 }')
if [ "$SIZE_MB" -gt "$MAX_SIZE_MB" ]; then
  log_error "Validation failed: Video size ($SIZE_MB MB) exceeds the maximum of $MAX_SIZE_MB MB."
fi

if (( $(awk -v dur="$DURATION" -v max_dur="$MAX_DURATION" 'BEGIN { print (dur > max_dur) }') )); then
  log_error "Validation failed: Video duration ($DURATION s) exceeds the maximum of $MAX_DURATION s."
fi

if [ "$WIDTH" -gt "$MAX_WIDTH" ]; then
  log_error "Validation failed: Video width ($WIDTH px) exceeds the maximum of $MAX_WIDTH px (4K)."
fi

FPS_VALUE=$(awk -F/ '{print $1 / $2}' <<< "$FPS_FRACTION")
if (( $(awk -v fps="$FPS_VALUE" -v max_fps="$MAX_FPS" 'BEGIN { print (fps > max_fps) }') )); then
  log_error "Validation failed: Video framerate ($FPS_VALUE FPS) exceeds the maximum of $MAX_FPS FPS."
fi

log_info "All pre-flight checks passed."

# Calculate rounded FPS and total frames for processing
FPS=$(printf "%.0f" "$FPS_VALUE")
TOTAL_FRAMES=$(awk -v dur="$DURATION" -v fps_val="$FPS_VALUE" 'BEGIN { printf "%.0f", dur * fps_val }')
log_info "Video is $DURATION seconds long at $FPS FPS, totaling $TOTAL_FRAMES frames."

# 3. Frame Extraction Loop (Frame-based logic)
log_info "Starting frame extraction based on a max of $MAX_FRAMES_PER_PART frames per part..."
let FRAMES_REMAINING=$TOTAL_FRAMES
let FRAMES_PROCESSED=0
let PART_INDEX=0

while [ "$FRAMES_REMAINING" -gt 0 ] && [ "$PART_INDEX" -lt "$MAX_PARTS" ]; do
  PART_DIR="$OUTPUT_DIR/part$PART_INDEX"
  mkdir -p "$PART_DIR"

  let FRAMES_IN_THIS_PART=$FRAMES_REMAINING
  if [ "$FRAMES_IN_THIS_PART" -gt "$MAX_FRAMES_PER_PART" ]; then
    let FRAMES_IN_THIS_PART=$MAX_FRAMES_PER_PART
  fi

  # Calculate timings for ffmpeg using awk for precision with the original FPS fraction
  START_TIME=$(awk -v processed="$FRAMES_PROCESSED" -v fps_frac="$FPS_FRACTION" 'BEGIN { printf "%.4f", processed / (fps_frac) }')
  PART_DURATION=$(awk -v frames="$FRAMES_IN_THIS_PART" -v fps_frac="$FPS_FRACTION" 'BEGIN { printf "%.4f", frames / (fps_frac) }')

  log_info "Part $PART_INDEX: Extracting $FRAMES_IN_THIS_PART frames (start time: ${START_TIME}s)..."

  ffmpeg -v error -i "$INPUT_VIDEO" \
         -ss "$START_TIME" \
         -t "$PART_DURATION" \
         -vf "scale=$TARGET_RESOLUTION,setsar=1" \
         -an \
         -y \
         "$PART_DIR/%05d.png"

  let FRAMES_REMAINING-=$FRAMES_IN_THIS_PART
  let FRAMES_PROCESSED+=$FRAMES_IN_THIS_PART
  let PART_INDEX+=1
done

if [ "$FRAMES_REMAINING" -gt 0 ]; then
  log_info "Warning: Max parts ($MAX_PARTS) reached, but $FRAMES_REMAINING frames were not processed. Animation may be shorter than video."
fi
let NUM_PARTS=$PART_INDEX
log_info "Frame extraction complete. Created $NUM_PARTS parts."

# 4. Create the desc.txt file
log_info "Creating dynamic desc.txt..."
TARGET_WIDTH=$(echo $TARGET_RESOLUTION | cut -d':' -f1)
TARGET_HEIGHT=$(echo $TARGET_RESOLUTION | cut -d':' -f2)

echo "$TARGET_WIDTH $TARGET_HEIGHT $FPS" > "$OUTPUT_DIR/desc.txt"

for (( i=0; i<$NUM_PARTS; i++ )); do
  if [ $i -eq $((NUM_PARTS - 1)) ]; then
    # Last part: loop forever
    echo "p 0 0 part$i" >> "$OUTPUT_DIR/desc.txt"
  else
    # Other parts: play once
    echo "p 1 0 part$i" >> "$OUTPUT_DIR/desc.txt"
  fi
done

log_info "desc.txt created successfully."

# 5. Package the bootanimation.zip
log_info "Packaging bootanimation.zip..."
(cd "$OUTPUT_DIR" && zip -0 -r ../bootanimation.zip ./*)

log_info "✅ All done! 'bootanimation.zip' has been created successfully."