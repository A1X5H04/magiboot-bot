#!/bin/bash

# ==============================================================================
#
#  Dual-Stream Logger (Minimal, Dependency-Free)
#
#  This script provides functions for a dual-logging strategy:
#
#  1. User-Facing Error Log (Plain Text):
#     - File: $USER_ERROR_LOG (e.g., /github/workspace/user_errors.log)
#     - Content: Simple, clean error messages for the end-user.
#     - Used by: `log_fatal`
#
#  2. Internal Debug Log (JSONL):
#     - File: $INTERNAL_DEBUG_LOG (e.g., /github/workspace/build_log.jsonl)
#     - Content: Structured JSON logs for developer debugging.
#     - Used by: `log_info`, `log_warn`, `log_fatal`
#     - Enabled by: `RUN_DEBUG_LOGS="true"`
#
# ==============================================================================

: "${INTERNAL_DEBUG_LOG:="build_log.jsonl"}"
: "${USER_ERROR_LOG:="user_errors.log"}"
: "${RUN_DEBUG_LOGS:="false"}" # Default to 'off' for performance

# --- Internal Log Emitter (for Developer Debug Log) ---
# @param $1 Log Level (e.g., INFO, WARN, FATAL)
# @param $2 Message
_log_internal() {
  local level="$1"
  local message="$2"
  local timestamp
  timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  jq -n -c \
    --arg level "$level" \
    --arg ts "$timestamp" \
    --arg msg "$message" \
    '{"level": $level, "ts": $ts, "msg": $msg}' >> "$INTERNAL_DEBUG_LOG"
}

# --- Public Log Functions ---

# For standard workflow steps (e.g., "Starting download...")
# Only logs if $RUN_DEBUG_LOGS is "true".
log_info() {
  if [[ "${RUN_DEBUG_LOGS}" == "true" ]]; then
    _log_internal "INFO" "$1"
  fi
}

# For non-fatal warnings (e.g., "Config value 'x' not set, using default.")
# Only logs if $RUN_DEBUG_LOGS is "true".
log_warn() {
  if [[ "${RUN_DEBUG_LOGS}" == "true" ]]; then
    _log_internal "WARN" "$1"
  fi
}

log_fatal() {
  local user_message="$1"

  echo "${user_message}" >> "$USER_ERROR_LOG"
  _log_internal "FATAL" "${user_message}"
  echo "::error::${user_message}" >&2  

  exit 1
}