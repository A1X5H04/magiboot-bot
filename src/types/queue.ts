export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface Job {
  // Core Identifiers
  jobId: string;
  chatId: number;
  statusMessageId: number;
  
  // State Management
  status: JobStatus;
  submittedAt: string; // ISO 8601 timestamp when user submitted
  processedAt?: string; // Timestamp when processor picks it up
  completedAt?: Date; // Timestamp when job finishes
  retries: number; // Number of times this job has been attempted

  // Input & Output Details
  videoFileId: string;
  originalFilename?: string; // Useful for debugging
  videoDuration?: number; // Can be used for validation or estimation
  outputKey?: string; // The key for the final file in R2 storage, e.g., "modules/jobId.zip"

  // Error Handling
  errorMessage?: string; // Stores the reason for failure
}