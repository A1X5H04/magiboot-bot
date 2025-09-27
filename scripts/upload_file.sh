#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -eo pipefail

# --- Configuration ---
# The base URL for the API.
BASE_URL="https://cloudfam.io/"

# --- Input Validation ---
# Check if the file path is provided as the first argument.
if [[ -z "$1" ]]; then
  echo "❌ Error: No file path provided."
  echo "Usage: $0 /path/to/your/file"
  exit 1
fi

FILE_PATH="$1"

# Check if the file exists.
if [[ ! -f "$FILE_PATH" ]]; then
  echo "❌ Error: File not found at '$FILE_PATH'"
  exit 1
fi

echo "🚀 Starting file upload process for: $FILE_PATH"

# --- Step 1: Create an Upload URL ---
echo "➡️ Step 1: Requesting secure upload URL..."
API_RESPONSE=$(curl --silent --show-error --location "${BASE_URL}api.php?action=create_upload_url")

# Check if the API call was successful and parse the response.
SUCCESS=$(echo "$API_RESPONSE" | jq -r '.success')

if [[ "$SUCCESS" != "true" ]]; then
  echo "❌ Error: Failed to get upload URL from API."
  echo "API Response: $API_RESPONSE"
  exit 1
fi

# Extract the URL and key using jq.
UPLOAD_URL=$(echo "$API_RESPONSE" | jq -r '.uploadURL')
UPLOAD_KEY=$(echo "$API_RESPONSE" | jq -r '.key')

if [[ -z "$UPLOAD_URL" || "$UPLOAD_URL" == "null" ]]; then
    echo "❌ Error: uploadURL was null or empty in the API response."
    exit 1
fi

echo "✅ Success! Received upload URL."

# --- Step 2: Upload the File ---
echo "➡️ Step 2: Uploading file data..."

# Determine the MIME type of the file.
MIME_TYPE=$(file --brief --mime-type "$FILE_PATH")
echo "   Detected MIME type: $MIME_TYPE"

# Perform the PUT request with the file data.
# The -f flag will cause curl to exit with an error code if the server returns an HTTP error.
curl --silent --show-error --fail \
     --request PUT "$UPLOAD_URL" \
     --header "Content-Type: $MIME_TYPE" \
     --data-binary @"$FILE_PATH"

echo "✅ Success! File data uploaded."

# --- Step 3: Finalize the Upload ---
echo "➡️ Step 3: Finalizing upload and getting download link..."
ORIGINAL_FILENAME=$(basename "$FILE_PATH")

# Create the JSON payload for the finalization step.
JSON_PAYLOAD=$(jq -n \
                  --arg key "$UPLOAD_KEY" \
                  --arg filename "$ORIGINAL_FILENAME" \
                  '{key: $key, original_filename: $filename}')

# Post the finalization request.
FINAL_RESPONSE=$(curl --silent --show-error --location \
                      --request POST "${BASE_URL}api.php?action=finalize_upload" \
                      --header "Content-Type: application/json" \
                      --data "$JSON_PAYLOAD")

# Check if finalization was successful.
FINAL_SUCCESS=$(echo "$FINAL_RESPONSE" | jq -r '.success')

if [[ "$FINAL_SUCCESS" != "true" ]]; then
  echo "❌ Error: Failed to finalize the upload."
  echo "API Response: $FINAL_RESPONSE"
  exit 1
fi

# Extract the download link.
DOWNLOAD_LINK=$(echo "$FINAL_RESPONSE" | jq -r '.download_link')

echo "✅ Success! File upload finalized."
echo "🔗 Download Link: $DOWNLOAD_LINK"

# --- Set GitHub Action Output ---
# This makes the download link available to subsequent steps in the same job.
if [[ -n "$GITHUB_OUTPUT" ]]; then
  echo "download_link=${DOWNLOAD_LINK}" >> "$GITHUB_OUTPUT"
  echo "✅ Set 'download_link' as a GitHub Actions output."
fi