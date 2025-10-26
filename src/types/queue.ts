import { BootAnimPart } from "./utils.ts";

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
  bootanim_config?: BootAnimPart[];
  video_ref_message_id: number;
  creator: { 
    name: string;
    id: number;
  }
  tags: string[];
}