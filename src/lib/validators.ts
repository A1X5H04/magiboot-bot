// lib/validators.ts

// We need the types from your Telegram framework (likely grammy)
import { Video, Document } from "https://esm.sh/@grammyjs/types@3.22.2/mod.d.ts";
import { ValidationRule } from "../types/utils.ts";
import { parseBootAnimConfig } from "./utils.ts";

// --- Constants ---

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_VIDEO_DURATION_S = 25;

/**
 * A list of common video MIME types compatible with ffmpeg.
 * This list can be expanded as needed.
 */
const ALLOWED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
  'video/x-matroska', // .mkv
  'video/x-msvideo', // .avi
  'video/mpeg',
]);


// --- Specific Validation Rules ---

/**
 * Checks if the media's file size is within the allowed limit.
 */
export const checkFileSize: ValidationRule<Video | Document> = (media) => {
  if (!media.file_size) {
    // We can't validate if Telegram doesn't provide the size.
    // Returning an error is the safest approach.
    return 'Cannot determine file size. Please try sending the file again.';
  }
  if (media.file_size > MAX_FILE_SIZE_BYTES) {
    return `File is too large (${(media.file_size / 1024 / 1024).toFixed(1)}MB). Maximum allowed size is ${MAX_FILE_SIZE_MB}MB.`;
  }
  return null;
};

/**
 * Checks if the video's duration is within the allowed limit.
 */
export const checkDuration: ValidationRule<Video> = (video) => {
  if (video.duration > MAX_VIDEO_DURATION_S) {
    return `Video is too long (${video.duration}s). Maximum allowed duration is ${MAX_VIDEO_DURATION_S}s.`;
  }
  return null;
};

/**
 * Checks if the video is in portrait orientation (height > width).
 */
export const checkIsPortrait: ValidationRule<Video> = (video) => {
  if (video.width >= video.height) {
    return 'Video must be in portrait orientation (height must be greater than width).';
  }
  return null;
};

/**
 * Checks if the video's MIME type is in our allowed list.
 */
export const checkVideoMimeType: ValidationRule<Video> = (video) => {
  if (!video.mime_type || !ALLOWED_VIDEO_MIME_TYPES.has(video.mime_type)) {
    return `Unsupported video format (${video.mime_type || 'unknown'}). Please use a common format like MP4, WebM, or MOV.`;
  }
  return null;
};

/**
 * Checks if the document's MIME type is an allowed *video* type.
 */
export const checkDocumentMimeType: ValidationRule<Document> = (doc) => {
  if (!doc.mime_type || !ALLOWED_VIDEO_MIME_TYPES.has(doc.mime_type)) {
    return `Unsupported document format (${doc.mime_type || 'unknown'}). Please send the video as a common video file (MP4, WebM, etc.), not as a generic document.`;
  }
  return null;
};

/*
 * Checks if the title is properly adhered to the syntax 
 */
/**
 * Validates the parsed boot animation configuration against logical constraints.
 * @param parts The array of BootAnimPart objects.
 * @param videoDuration The total duration of the video in the same unit as time (e.g., seconds).
 * @returns An error message string or null if validation passes.
 */
export const checkBootAnimParts: ValidationRule<string> = (
  configString,
) => {
  try {

  const parts = parseBootAnimConfig(configString);
    
    // If configuration is empty, it's valid (will use the single part animation).
  if (parts.length === 0) {
    return null;
  }

  let previousEndTime = 0;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const partIndex = i + 1;
    const currentStartTime = previousEndTime;

    
    if (part.timeframe.value !== null && part.timeframe.value <= currentStartTime) {
      const startDisplay = i === 0 ? '0' : currentStartTime;
      return `[Part ${partIndex}]: End time (${part.timeframe.value}) must be greater than its start time (${startDisplay}). Please check your time sequence.`;
    }
    
    if (part.count < 0) {
      return `[Part ${partIndex}]: Count (${part.count}) cannot be a negative number.`;
    }
    if (part.pause < 0) {
      return `[Part ${partIndex}]: Pause (${part.pause}) cannot be a negative number.`;
    }
    
    const isLastPart = (i === parts.length - 1);
    if (part.timeframe.value === null && !isLastPart) {
      return `[Part ${partIndex}]: The 'end' keyword can only be used on the final part of your configuration.`;
    }

    previousEndTime = part.timeframe.value!;
  }

  return null;
} catch (err) {
  return (err as Error).message || "Failed to parse config, please view the documentation CAREFULLY!"
}
};