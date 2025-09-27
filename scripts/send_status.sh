#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Input Validation ---
if [[ -z "$1" ]]; then
  echo "❌ Error: Status type not provided."
  echo "Usage: $0 <status_type> <message>"
  exit 1
fi

if [[ -z "$2" ]]; then
  echo "❌ Error: Message not provided."
  echo "Usage: $0 <status_type> <message>"
  exit 1
fi

# These are expected to be in the GitHub Actions environment
if [[ -z "$JOB_ID" || -z "$BOT_WEBHOOK_URL" ]]; then
  echo "❌ Error: JOB_ID or BOT_WEBHOOK_URL environment variables are not set."
  exit 1
fi

STATUS_TYPE="$1"
MESSAGE="$2"

echo "Sending status: $STATUS_TYPE - $MESSAGE"

curl --silent --show-error --fail \
     -X POST -H "Content-Type: application/json" \
     -d "{\"jobId\": \"${JOB_ID}\", \"status\": \"${STATUS_TYPE}\", \"message\": \"${MESSAGE}\"}" \
     "${BOT_WEBHOOK_URL}"
