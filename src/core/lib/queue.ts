import { CustomContext } from "../../types/context";
import { Job, JobStatus } from "../../types/queue";
import { generateRandomId } from "./generators";


export const QueueService = {
  /**
   * Creates and adds a new job to the pending queue.
   */
  async add(ctx: CustomContext, data: { chatId: number; statusMessageId: number; videoFileId: string; }): Promise<Job> {
    const job: Job = {
      jobId: generateRandomId(),
      chatId: data.chatId,
      statusMessageId: data.statusMessageId,
      videoFileId: data.videoFileId,
      status: "pending",
      submittedAt: new Date().toISOString(),
      retries: 0,
    };

    const key = `queue:pending:${job.jobId}`;
    await ctx.env.JOB_QUEUE.put(key, JSON.stringify(job));
    
    console.log(`Job ${job.jobId} added to the queue.`);
    return job;
  },

  /**
   * Fetches a job from the queue by its ID and current status.
   */
  async get(ctx: CustomContext, jobId: string, status: JobStatus): Promise<Job | null> {
    const key = `queue:${status}:${jobId}`;
    const value = await ctx.env.JOB_QUEUE.get(key);
    return value ? JSON.parse(value) : null;
  },

  /**
   * Updates a job's status by moving it to a new state prefix in KV.
   * This pattern prevents race conditions, as a job can only exist in one state at a time.
   */
  async updateStatus(ctx: CustomContext, job: Job, newStatus: JobStatus): Promise<Job> {
    const oldKey = `queue:${job.status}:${job.jobId}`;
    
    // Update the job object
    const updatedJob: Job = { ...job, status: newStatus };
    if (newStatus === "processing") updatedJob.processedAt = new Date().toISOString();
    
    const newKey = `queue:${newStatus}:${job.jobId}`;
    
    // Put the new key first, then delete the old one to ensure no data is lost.
    await ctx.env.JOB_QUEUE.put(newKey, JSON.stringify(updatedJob));
    await ctx.env.JOB_QUEUE.delete(oldKey);

    console.log(`Job ${job.jobId} status updated from ${job.status} to ${newStatus}.`);
    return updatedJob;
  },

  /**
   * Completely removes a job from the queue upon successful completion.
   */
  async remove(ctx: CustomContext, jobId: string, status: JobStatus): Promise<void> {
    const key = `queue:${status}:${jobId}`;
    await ctx.env.JOB_QUEUE.delete(key);
    console.log(`Job ${jobId} removed from the queue.`);
  },
};