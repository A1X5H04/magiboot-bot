#!/bin/bash


main () {
# --- Strict Mode & Dependencies ---
set -o pipefail
command -v curl >/dev/null 2>&1 || { echo "FATAL: curl is not installed." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "FATAL: jq is not installed." >&2; exit 1; }

# --- Validate Environment ---
: "${TELEGRAM_BOT_WEBHOOK_URL?Error: TELEGRAM_BOT_WEBHOOK_URL env var must be set.}"
: "${BOT_TOKEN?Error: BOT_TOKEN env var must be set.}"
: "${JOB_ID?Error: JOB_ID env var must be set.}"
: "${MSG_METADATA_JSON?Error: MSG_METADATA_JSON env var must be set.}"
: "${USER_ERROR_LOG?Error: USER_ERROR_LOG env var must be set.}"
: "${CURRENT_STAGE?Error: CURRENT_STAGE env var must be set.}"

# --- Parse Arguments ---
STATUS=""
DATA_JSON=""
MESSAGE="" # This is now ONLY for the "failed" status fallback

while [ $# -gt 0 ]; do
  case "$1" in
    --status) STATUS="$2"; shift 2 ;;
    --data) DATA_JSON="$2"; shift 2 ;;
    --message) MESSAGE="$2"; shift 2 ;; # Only used if status is 'failed'
    *) shift ;;
  esac
done

if [ -z "$STATUS" ]; then
  echo "FATAL: --status is required." >&2
  exit 1
fi

# --- Prepare Error Payloads (if needed) ---
ERROR_LIST_JSON="[]"
ERROR_PLAIN_TEXT=""

if [ "$STATUS" == "failed" ]; then
    if [ -f "$USER_ERROR_LOG" ] && [ -s "$USER_ERROR_LOG" ]; then
        ERROR_LIST_JSON=$(jq -R -s -c 'split("\n") | map(select(length > 0))' "$USER_ERROR_LOG")
        ERROR_PLAIN_TEXT=$(sed 's/^/- /' "$USER_ERROR_LOG")
    else
        # No specific errors found, but we still have the generic $MESSAGE
        ERROR_PLAIN_TEXT="- ${MESSAGE}"
    fi
    
    if [ -z "$MESSAGE" ]; then
      echo "::warning:: 'failed' status sent without a --message fallback." >&2
      MESSAGE="Job failed. See error list for details."
    fi
fi

# --- Attempt 1: Primary Webhook ---
echo "Attempting to send notification (status: $STATUS) to webhook..." >&2

# FIX: Build the correct NESTED JSON structure based on the schema.
# 1. Create the nested 'tg_metadata' object with camelCase keys.
# 2. Add 'post_metadata' as a nested object only if status is 'completed'.
FILTER_FILE=$(mktemp)
cat << 'EOF_JQ_FILTER' > "$FILTER_FILE"
{
  status: $status,
  job_id: $jobId,
  tg_metadata: {
    chatId: $tgMetadata.chat_id,
    messageId: $tgMetadata.message_id
  }
}
| if $status == "failed" then
    . + {message: $message, error_list: $errors}
  else
    . # Pass through unchanged
  end
| if $status == "completed" and $ARGS.named.data != null and $ARGS.named.data != "" then
    . + {post_metadata: ($ARGS.named.data | fromjson)} # Merge data nested under "post_metadata"
  else
    .
  end
EOF_JQ_FILTER

PRIMARY_PAYLOAD=$(jq -n \
  --arg status "$STATUS" \
  --arg jobId "$JOB_ID" \
  --argjson tgMetadata "$MSG_METADATA_JSON" \
  --arg message "$MESSAGE" \
  --argjson errors "$ERROR_LIST_JSON" \
  --arg data "$DATA_JSON" \
  -f "$FILTER_FILE"
)

# Clean up the temp file immediately
rm -f "$FILTER_FILE"

# Capture stderr and stdout from curl, and its exit code
# We use --fail to make curl exit with 22 on 4xx/5xx errors
# We use --max-time 15 for a 15-second timeout
curl_output_file=$(mktemp)
set +e # Disable exit-on-error temporarily
curl --request POST \
     --header "Content-Type: application/json" \
     --data "$PRIMARY_PAYLOAD" \
     --silent \
     --show-error \
     --fail \
     --max-time 15 \
     "$TELEGRAM_BOT_WEBHOOK_URL" > "$curl_output_file" 2>&1
curl_exit_code=$?
set -e # Re-enable exit-on-error

# --- Check Result and Attempt 2 (Fallback) ---
if [ "$curl_exit_code" -eq 0 ]; then
    # --- SUCCESS ---
    echo "Webhook notification sent successfully." >&2
    rm -f "$curl_output_file"
    exit 0
fi

# --- PRIMARY FAILED ---
echo "::warning::Webhook notification failed (curl code: $curl_exit_code)." >&2
curl_error=$(cat "$curl_output_file")
rm -f "$curl_output_file"


if [ "$STATUS" == "failed" ]; then
    echo "::warning::Triggering direct Telegram API fallback..." >&2

    # This fallback still works because MSG_METADATA_JSON still
    # contains the original "chat_id" and "message_id" (snake_case).
    CHAT_ID=$(echo "$MSG_METADATA_JSON" | jq -r '.chat_id')
    MESSAGE_ID=$(echo "$MSG_METADATA_JSON" | jq -r '.message_id')
    
    # We now use the $MESSAGE variable as the base
    ESCAPED_CURL_ERROR=$(echo "$curl_error" | sed 's/`/\\`/g')
    FALLBACK_TEXT=$(echo -e "❌ *Status*: Failed.\n${MESSAGE}\n\n*Errors:*\n${ERROR_PLAIN_TEXT}\n\n---\n*Notification service failed (Code: $curl_exit_code).*\\n\`${ESCAPED_CURL_ERROR}\`\\n\\nReport to @a1x5h04.")

    FALLBACK_SEND_PAYLOAD=$(jq -n -c \
      --arg cid "$CHAT_ID" \
      --arg mid "$MESSAGE_ID" \
      --arg text "$FALLBACK_TEXT" \
      '{chat_id: $cid, text: $text, parse_mode: "Markdown", reply_parameters: { message_id: $mid } }')

    curl --request POST \
        --header "Content-Type: application/json" \
        --data "$FALLBACK_SEND_PAYLOAD" \
        --show-error \
        --fail \
        --max-time 15 \
        "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" 1>&2
    
    echo "Fallback notification attempt finished." >&2

else
    echo "::warning::Non-critical notification ($STATUS) failed to send. Not attempting fallback." >&2
fi

exit 0

}

main "$@"


