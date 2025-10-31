#!/bin/bash

# ==============================================================================
# Robust Notification Script with Full Error Handling
# ==============================================================================

main() {
    # --- Strict Mode ---
    set -o pipefail
    
    # --- Validate Dependencies ---
    if ! command -v curl >/dev/null 2>&1; then
        echo "FATAL: curl is not installed." >&2
        exit 1
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        echo "FATAL: jq is not installed." >&2
        exit 1
    fi

    # --- Validate Required Environment Variables ---
    local required_vars=(
        "TELEGRAM_BOT_WEBHOOK_URL"
        "BOT_TOKEN"
        "JOB_ID"
        "MSG_METADATA_JSON"
        "CURRENT_STAGE"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo "FATAL: Required environment variable $var is not set." >&2
            exit 1
        fi
    done

    # --- Parse Arguments ---
    local STATUS=""
    local DATA_JSON=""
    local MESSAGE=""
    
    while [ $# -gt 0 ]; do
        case "$1" in
            --status) STATUS="$2"; shift 2 ;;
            --data) DATA_JSON="$2"; shift 2 ;;
            --message) MESSAGE="$2"; shift 2 ;;
            *) echo "Warning: Unknown argument $1" >&2; shift ;;
        esac
    done

    # --- Validate Status ---
    if [ -z "$STATUS" ]; then
        echo "FATAL: --status argument is required." >&2
        exit 1
    fi
    
    if [[ ! "$STATUS" =~ ^(pending|processing|completed|failed)$ ]]; then
        echo "FATAL: Invalid status '$STATUS'. Must be one of: pending, processing, completed, failed" >&2
        exit 1
    fi

    # --- Extract and Validate Message Metadata ---
    local CHAT_ID MESSAGE_ID
    
    if ! CHAT_ID=$(echo "$MSG_METADATA_JSON" | jq -r '.chatId // .chat_id // empty' 2>/dev/null); then
        echo "FATAL: Failed to parse MSG_METADATA_JSON with jq." >&2
        exit 1
    fi
    
    if ! MESSAGE_ID=$(echo "$MSG_METADATA_JSON" | jq -r '.messageId // .message_id // empty' 2>/dev/null); then
        echo "FATAL: Failed to parse MSG_METADATA_JSON with jq." >&2
        exit 1
    fi
    
    if [ -z "$CHAT_ID" ] || [ "$CHAT_ID" == "null" ]; then
        echo "FATAL: Could not extract chatId from MSG_METADATA_JSON." >&2
        echo "MSG_METADATA_JSON content: $MSG_METADATA_JSON" >&2
        exit 1
    fi
    
    if [ -z "$MESSAGE_ID" ] || [ "$MESSAGE_ID" == "null" ]; then
        echo "FATAL: Could not extract messageId from MSG_METADATA_JSON." >&2
        echo "MSG_METADATA_JSON content: $MSG_METADATA_JSON" >&2
        exit 1
    fi

    echo "Extracted metadata - ChatID: $CHAT_ID, MessageID: $MESSAGE_ID" >&2

    # --- Prepare Error Information (for failed status) ---
    local ERROR_LIST_JSON="[]"
    local ERROR_PLAIN_TEXT=""
    
    if [ "$STATUS" == "failed" ]; then
        if [ -f "${USER_ERROR_LOG:-}" ] && [ -s "${USER_ERROR_LOG:-}" ]; then
            ERROR_LIST_JSON=$(jq -R -s -c 'split("\n") | map(select(length > 0))' "$USER_ERROR_LOG" 2>/dev/null || echo "[]")
            ERROR_PLAIN_TEXT=$(sed 's/^/- /' "$USER_ERROR_LOG" 2>/dev/null || echo "")
        fi
        
        if [ -z "$MESSAGE" ]; then
            MESSAGE="Job failed at stage: ${CURRENT_STAGE}"
        fi
        
        if [ -z "$ERROR_PLAIN_TEXT" ]; then
            ERROR_PLAIN_TEXT="- ${MESSAGE}"
        fi
    fi

    # --- Build Webhook Payload (matching TypeScript schema) ---
    echo "Building webhook payload for status: $STATUS..." >&2
    
    local PAYLOAD
    if ! PAYLOAD=$(build_webhook_payload "$STATUS" "$JOB_ID" "$CHAT_ID" "$MESSAGE_ID" "$MESSAGE" "$ERROR_LIST_JSON" "$DATA_JSON"); then
        echo "FATAL: Failed to build webhook payload." >&2
        exit 1
    fi
    
    echo "Payload built successfully." >&2
    echo "Payload preview: $(echo "$PAYLOAD" | jq -c '.' 2>/dev/null || echo "$PAYLOAD")" >&2

    # --- Attempt Webhook Notification ---
    echo "Sending notification to webhook: $TELEGRAM_BOT_WEBHOOK_URL" >&2
    
    local webhook_response
    local webhook_http_code
    local webhook_success=false
    
    webhook_response=$(mktemp)
    
    set +e
    webhook_http_code=$(curl --request POST \
        --url "$TELEGRAM_BOT_WEBHOOK_URL" \
        --header "Content-Type: application/json" \
        --data "$PAYLOAD" \
        --write-out "%{http_code}" \
        --silent \
        --show-error \
        --max-time 15 \
        --output "$webhook_response" 2>&1)
    local curl_exit_code=$?
    set -e
    
    # Check if webhook succeeded
    if [ "$curl_exit_code" -eq 0 ] && [ "$webhook_http_code" -ge 200 ] && [ "$webhook_http_code" -lt 300 ]; then
        webhook_success=true
        echo "✓ Webhook notification sent successfully (HTTP $webhook_http_code)." >&2
        rm -f "$webhook_response"
        exit 0
    fi
    
    # --- Webhook Failed - Log Details ---
    echo "✗ Webhook notification failed." >&2
    echo "  - HTTP Code: $webhook_http_code" >&2
    echo "  - Curl Exit Code: $curl_exit_code" >&2
    
    if [ -f "$webhook_response" ]; then
        local response_body=$(cat "$webhook_response" 2>/dev/null || echo "(unable to read response)")
        echo "  - Response Body: $response_body" >&2
        rm -f "$webhook_response"
    fi

    # --- Fallback: Direct Telegram API ---
    # Only attempt fallback for critical failures or if status is 'failed'
    if [ "$STATUS" == "failed" ] || [ "$webhook_http_code" -ge 500 ]; then
        echo "Attempting fallback notification via Telegram API..." >&2
        
        if send_telegram_fallback "$CHAT_ID" "$MESSAGE_ID" "$STATUS" "$MESSAGE" "$ERROR_PLAIN_TEXT" "$webhook_http_code" "$curl_exit_code"; then
            echo "✓ Fallback notification sent successfully." >&2
            exit 0
        else
            echo "✗ Fallback notification also failed." >&2
        fi
    else
        echo "Skipping fallback for non-critical status: $STATUS" >&2
    fi

    # If we reach here, all notification attempts failed
    # For non-failed statuses, we don't want to fail the workflow
    if [ "$STATUS" != "failed" ]; then
        echo "::warning::Non-critical notification ($STATUS) could not be delivered." >&2
        exit 0
    fi
    
    # For failed status, we tried everything, so exit with error
    echo "::error::Critical failure notification could not be delivered." >&2
    exit 1
}

# ==============================================================================
# Build webhook payload matching the TypeScript schema
# ==============================================================================
build_webhook_payload() {
    local status="$1"
    local job_id="$2"
    local chat_id="$3"
    local message_id="$4"
    local message="$5"
    local error_list_json="$6"
    local data_json="$7"
    
    # Convert chat_id to number if it's numeric, otherwise keep as string
    local chat_id_value
    if [[ "$chat_id" =~ ^-?[0-9]+$ ]]; then
        chat_id_value="$chat_id"
    else
        chat_id_value="\"$chat_id\""
    fi
    
    # Convert message_id to number
    local message_id_value
    if [[ "$message_id" =~ ^[0-9]+$ ]]; then
        message_id_value="$message_id"
    else
        echo "ERROR: messageId must be numeric, got: $message_id" >&2
        return 1
    fi
    
    local base_payload
    base_payload=$(jq -n -c \
        --arg status "$status" \
        --arg job_id "$job_id" \
        --argjson chat_id "$chat_id_value" \
        --argjson message_id "$message_id_value" \
        '{
            status: $status,
            job_id: $job_id,
            tg_metadata: {
                chatId: $chat_id,
                messageId: $message_id
            }
        }' 2>/dev/null)
    
    if [ $? -ne 0 ] || [ -z "$base_payload" ]; then
        echo "ERROR: Failed to build base payload" >&2
        return 1
    fi
    
    # Add status-specific fields
    case "$status" in
        failed)
            if [ -n "$error_list_json" ] && [ "$error_list_json" != "[]" ]; then
                base_payload=$(echo "$base_payload" | jq -c \
                    --arg message "$message" \
                    --argjson error_list "$error_list_json" \
                    '. + {message: $message, error_list: $error_list}' 2>/dev/null)
            else
                base_payload=$(echo "$base_payload" | jq -c \
                    --arg message "$message" \
                    '. + {message: $message}' 2>/dev/null)
            fi
            ;;
        completed)
            if [ -n "$data_json" ] && [ "$data_json" != "null" ]; then
                # Validate that data_json is valid JSON
                if echo "$data_json" | jq empty 2>/dev/null; then
                    base_payload=$(echo "$base_payload" | jq -c \
                        --argjson post_metadata "$data_json" \
                        '. + {post_metadata: $post_metadata}' 2>/dev/null)
                else
                    echo "ERROR: Invalid JSON in data parameter" >&2
                    return 1
                fi
            else
                echo "ERROR: 'completed' status requires --data parameter with post_metadata" >&2
                return 1
            fi
            ;;
        pending|processing)
            # These statuses only need base payload
            ;;
    esac
    
    if [ $? -ne 0 ] || [ -z "$base_payload" ]; then
        echo "ERROR: Failed to build final payload" >&2
        return 1
    fi
    
    echo "$base_payload"
    return 0
}

# ==============================================================================
# Send fallback notification via Telegram API
# ==============================================================================
send_telegram_fallback() {
    local chat_id="$1"
    local message_id="$2"
    local status="$3"
    local message="$4"
    local error_text="$5"
    local webhook_http_code="$6"
    local curl_exit_code="$7"
    
    local status_emoji
    case "$status" in
        completed) status_emoji="✅" ;;
        processing) status_emoji="⚙️" ;;
        pending) status_emoji="⏳" ;;
        failed) status_emoji="❌" ;;
        *) status_emoji="ℹ️" ;;
    esac
    
    local fallback_text
    if [ "$status" == "failed" ]; then
        fallback_text="${status_emoji} *Status*: Failed

${message}

*Errors:*
${error_text}

---
⚠️ *Notification system issue* (HTTP ${webhook_http_code}, Code ${curl_exit_code})
Please report to @a1x5h04 if this persists."
    else
        fallback_text="${status_emoji} *Status*: ${status^}

⚠️ Notification service temporarily unavailable.
Your job is ${status}.

Job ID: \`${JOB_ID}\`"
    fi
    
    local telegram_payload
    telegram_payload=$(jq -n -c \
        --arg chat_id "$chat_id" \
        --argjson message_id "$message_id" \
        --arg text "$fallback_text" \
        '{
            chat_id: $chat_id,
            text: $text,
            parse_mode: "Markdown",
            reply_parameters: {
                message_id: $message_id
            }
        }' 2>/dev/null)
    
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to build Telegram fallback payload" >&2
        return 1
    fi
    
    set +e
    local tg_http_code
    tg_http_code=$(curl --request POST \
        --url "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
        --header "Content-Type: application/json" \
        --data "$telegram_payload" \
        --write-out "%{http_code}" \
        --silent \
        --max-time 15 \
        --output /dev/null)
    local tg_exit_code=$?
    set -e
    
    if [ "$tg_exit_code" -eq 0 ] && [ "$tg_http_code" -ge 200 ] && [ "$tg_http_code" -lt 300 ]; then
        return 0
    else
        echo "ERROR: Telegram API fallback failed (HTTP $tg_http_code, Exit $tg_exit_code)" >&2
        return 1
    fi
}

# ==============================================================================
# Execute main function
# ==============================================================================
main "$@"