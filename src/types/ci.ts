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
  completedAt?: string; // Timestamp when job finishes
  retries: number;
  
  // Data
  fileId: string;
  metadata: {
    title: string
    video_ref_message_id: number;
    creator: {
      name: string;
      id: number;
    }
    // More metadata will be added
  }
}

export type QueueKey = `queue:${string}:${string}`

export interface DispatchResult {
  success: boolean;
  // The run ID, if the provider returns one immediately (GitHub doesn't)
  runId?: string | null;
  message: string;
}


export interface CIProvider {
  // A unique identifier for the provider (e.g., "github-main")
  id: string;
  // Checks if the provider can accept a new job.
  isAvailable: () => Promise<boolean>;
  // Triggers the workflow with the given inputs.
  triggerWorkflow: (inputs: Record<string, any>) => Promise<DispatchResult>;
}