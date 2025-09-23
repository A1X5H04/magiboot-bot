export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface Job {
  // Core Identifiers
  jobId: string;
  chatId: number;
  userId: number;
  statusMessageId: number;
  
  // State Management
  status: JobStatus;
  submittedAt: string; // ISO 8601 timestamp when user submitted
  processedAt?: string; // Timestamp when processor picks it up
  completedAt?: Date; // Timestamp when job finishes
  
  // Data
  videoFileId: string;
  metadata: {
    title: string
    // More metadata will be added
  }
}