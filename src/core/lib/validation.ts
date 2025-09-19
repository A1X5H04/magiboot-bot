import { Context } from 'grammy';

export const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm'] as const;
export const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.mov'] as const;

export type FileType = 'video' | 'bootanimation' | 'invalid';

export interface FileValidationResult {
  isValid: boolean;
  type: FileType;
  error?: string;
}
/**
 * Validates if the uploaded file is a supported video or bootanimation
 */
export async function validateFile(ctx: Context): Promise<FileValidationResult> {
  try {
    if (!ctx.msg?.document && !ctx.msg?.video) {
      return { 
        isValid: false, 
        type: 'invalid',
        error: '❌ No file detected. Please upload a video or bootanimation file.'
      };
    }

    const file = ctx.msg?.document || ctx.msg?.video;
    if (!file) {
      return {
        isValid: false,
        type: 'invalid',
        error: '❌ Could not process the uploaded file.'
      };
    }

    // Check for video file
    if ('mime_type' in file && SUPPORTED_VIDEO_TYPES.includes(file.mime_type as any)) {
      return { isValid: true, type: 'video' };
    }

    // Check for bootanimation zip
    if (file.file_name?.endsWith('.zip')) {
      // TODO: Add bootanimation zip structure validation
      return { isValid: true, type: 'bootanimation' };
    }

    return {
      isValid: false,
      type: 'invalid',
      error: '❌ Unsupported file type. Please upload a video (MP4, MKV, WebM) or bootanimation ZIP file.'
    };
  } catch (error) {
    console.error('Error validating file:', error);
    return {
      isValid: false,
      type: 'invalid',
      error: '❌ An error occurred while validating your file. Please try again.'
    };
  }
}

/**
 * Validates user input for metadata fields
 */
export function validateMetadata(field: 'name' | 'category' | 'tags', value: string): { isValid: boolean; error?: string } {
  if (!value || value.trim().length === 0) {
    return { 
      isValid: false, 
      error: `❌ ${field.charAt(0).toUpperCase() + field.slice(1)} cannot be empty.`
    };
  }

  const maxLengths = {
    name: 100,
    category: 50,
    tags: 200
  };

  if (value.length > maxLengths[field]) {
    return {
      isValid: false,
      error: `❌ ${field.charAt(0).toUpperCase() + field.slice(1)} is too long. Maximum ${maxLengths[field]} characters.`
    };
  }

  // Additional validation for specific fields
  if (field === 'tags') {
    const tags = value.split(',').map(tag => tag.trim()).filter(Boolean);
    if (tags.length > 10) {
      return {
        isValid: false,
        error: '❌ You can add a maximum of 10 tags.'
      };
    }
  }

  return { isValid: true };
}
