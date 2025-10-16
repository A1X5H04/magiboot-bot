export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface JobMetadata {
  // Core Identifiers
  message: {
    chatId: number;
    userId?: number;
    messageId: number;
  }

  file_id: string;
  unique_file_id: string;
  title: string;
  video_ref_message_id: number;
  creator: { 
    name: string;
    id: number;
  }
}