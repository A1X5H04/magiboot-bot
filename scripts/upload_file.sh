#!/bin/bash

# ==============================================================================
#
#  CloudFam File Uploader
#
#  This script uploads a file through a 3-step API process and returns
#  the final download link as its standard output. All informational logs
#  are sent to standard error.
#
# ==============================================================================

# --- Strict Mode ---
set -eo pipefail

# --- Configuration ---
BASE_URL="https://cloudfam.io/"

# --- Helper Functions ---

##
# Logs an informational message to stderr.
#
log_info() {
  echo "INFO: $1" >&2
}

##
# Logs an error message to stderr and exits with a non-zero status.
#
log_error() {
  echo "❌ ERROR: $1" >&2
  exit 1
}

# --- Core Logic Functions ---

##
# Checks for required system dependencies (curl, jq, file).
#
check_dependencies() {
  command -v curl >/dev/null 2>&1 || log_error "Dependency 'curl' is not installed."
  command -v jq >/dev/null 2>&1 || log_error "Dependency 'jq' is not installed."
  command -v file >/dev/null 2>&1 || log_error "Dependency 'file' is not installed."
}

##
# Step 1: Requests a secure upload URL from the API.
# Outputs the UPLOAD_URL and UPLOAD_KEY on a single line.
#
create_upload_url() {
  log_info "Requesting secure upload URL..."
  local api_response
  api_response=$(curl --silent --show-error --location "${BASE_URL}api.php?action=create_upload_url")

  # Use jq's -e flag to exit with an error if '.success' is not true
  echo "$api_response" | jq -e '.success == true' >/dev/null || log_error "Failed to get upload URL. API Response: $api_response"

  local upload_url upload_key
  upload_url=$(echo "$api_response" | jq -r '.uploadURL')
  upload_key=$(echo "$api_response" | jq -r '.key')

  if [[ -z "$upload_url" || "$upload_url" == "null" || -z "$upload_key" || "$upload_key" == "null" ]]; then
    log_error "API response missing 'uploadURL' or 'key'."
  fi

  log_info "Received upload credentials."
  # "Return" both values by echoing them on one line, space-separated
  echo "$upload_url $upload_key"
}

##
# Step 2: Uploads the file data to the pre-signed URL.
# Arguments:
#   $1: The secure upload URL.
#   $2: The local path to the file.
#
upload_file() {
  local upload_url="$1"
  local file_path="$2"
  log_info "Uploading file data..."

  local mime_type
  mime_type=$(file --brief --mime-type "$file_path")
  log_info "Detected MIME type: $mime_type"

  curl --silent --show-error --fail \
       --request PUT "$upload_url" \
       --header "Content-Type: $mime_type" \
       --data-binary @"$file_path" || log_error "File data upload failed (curl exited with an error)."
  
  log_info "File data uploaded successfully."
}

##
# Step 3: Finalizes the upload to get the permanent download link.
# Arguments:
#   $1: The upload key from Step 1.
#   $2: The original file path.
# Outputs the final download link to standard output.
#
finalize_upload() {
  local upload_key="$1"
  local file_path="$2"
  log_info "Finalizing upload..."
  
  local original_filename
  original_filename=$(basename "$file_path")

  local json_payload
  json_payload=$(jq -n --arg key "$upload_key" --arg filename "$original_filename" \
                    '{key: $key, original_filename: $filename}')

  local final_response
  final_response=$(curl --silent --show-error --location \
                        --request POST "${BASE_URL}api.php?action=finalize_upload" \
                        --header "Content-Type: application/json" \
                        --data "$json_payload")

  echo "$final_response" | jq -e '.success == true' >/dev/null || log_error "Failed to finalize upload. API Response: $final_response"

  local download_link
  download_link=$(echo "$final_response" | jq -r '.download_link')
  
  if [[ -z "$download_link" || "$download_link" == "null" ]]; then
    log_error "API response missing 'download_link' after finalization."
  fi
  
  log_info "Upload finalized successfully."
  # This function's standard output is the final download link
  echo "$download_link"
}

# --- Main Execution ---

main() {
  check_dependencies

  if [[ -z "$1" ]]; then
    log_error "No file path provided. Usage: $0 /path/to/your/file"
  fi
  local file_path="$1"
  [[ -f "$file_path" ]] || log_error "File not found at '$file_path'"

  log_info "🚀 Starting file upload process for: $file_path"

  # --- Execute Steps ---
  local upload_url upload_key
  # Use process substitution and 'read' to capture the two "returned" values
  read -r upload_url upload_key < <(create_upload_url)
  
  upload_file "$upload_url" "$file_path"
  
  # The final link is captured from the function's stdout
  local download_link
  download_link=$(finalize_upload "$upload_key" "$file_path")

  # --- Handle Outputs ---
  # Set GitHub Action Output if in that environment
  if [[ -n "$GITHUB_OUTPUT" ]]; then
    echo "download_link=${download_link}" >> "$GITHUB_OUTPUT"
    log_info "✅ Set 'download_link' as a GitHub Actions output."
  fi

  # The primary "return value" of the script
  echo "$download_link"
}

# Run the main function with all provided script arguments
main "$@"