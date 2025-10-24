#!/bin/bash

# ==============================================================================
#
#  Structured JSON Logger
#
#  Provides functions to write structured JSONL (JSON Lines) logs.
#  All logs are appended to the file defined by $WORKFLOW_LOG_FILE.
#
#  Usage:
#    export WORKFLOW_LOG_FILE="build.log"
#    source scripts/logger.sh
#    log_info "This is an info message"
#    log_user "This message is for the user"
#    log_fatal "This is a fatal error"
#
# ==============================================================================

: "${WORKFLOW_LOG_FILE:="workflow.log.jsonl"}"

# --- Internal Log Emitter ---
# @param $1 Log Level (e.g., INFO, ERROR, USER)
# @param $2 Message
_log() {
  local level="$1"
  local message="$2"
  local timestamp
  timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Create a JSON line and append it to the log file
  jq -n -c \
    --arg level "$level" \
    --arg ts "$timestamp" \
    --arg msg "$message" \
    '{"level": $level, "ts": $ts, "msg": $msg}' >> "$WORKFLOW_LOG_FILE"
}

# --- Public Log Functions ---

# For standard workflow steps
log_info() {
  _log "INFO" "$1"
}

# For non-fatal warnings
log_warn() {
  _log "WARN" "$1"
}

# For messages that should be shown to the end-user on failure
log_user() {
  _log "USER" "$1"
}

# For debug messages (only logs if $RUNNER_DEBUG is true)
log_debug() {
  if [[ "${RUNNER_DEBUG}" == "true" ]]; then
    _log "DEBUG" "$1"
  fi
}

# For fatal errors that should stop the workflow
log_fatal() {
  _log "FATAL" "$1"
  # Also print to stderr for immediate visibility in GHA logs
  echo "::error::$1" >&2
  exit 1
}

# --- Helper Function for Error Reporting ---

# Extracts and beautifies logs for the end-user.
# This is what we'll use in the `notify_failure` job.
get_user_logs() {
  if [ ! -f "$WORKFLOW_LOG_FILE" ]; then
    echo "❌ A fatal error occurred before logs could be written."
    return
  fi

  # Read the JSONL file and format it for the user
  # We select only USER and FATAL logs.
  jq -r \
    'if .level == "USER" then "➡️ " + .msg elif .level == "FATAL" then "❌ " + .msg else empty end' \
    "$WORKFLOW_LOG_FILE"
}