export interface DispatchResult {
  success: boolean;
  // The run ID, if the provider returns one immediately (GitHub doesn't)
  runId?: string | null;
  message: string;
}

export interface CIProvider {
  id: string;
  isAvailable: () => Promise<boolean>;
  triggerWorkflow: (inputs: Record<string, any>) => Promise<DispatchResult>;
}
