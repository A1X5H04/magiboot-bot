import { CustomContext } from "../types/context";
import { Job, JobStatus } from "../types/queue";
import { generateRandomId } from "../core/lib/generators";


interface JobData {
  statusMessageId: number;
  videoFileId: string;
  title: string
}

export async function addToQueue(ctx: CustomContext, data: JobData): Promise<Job> {
  const chatId = ctx.chat?.id 
  const userId = ctx.from?.id

  if (!userId || !chatId) {
    throw new Error("User ID or Chat ID not found");
  }

  const job: Job = {
    jobId: generateRandomId(),
    chatId: chatId,
    userId: userId,
    statusMessageId: data.statusMessageId,
    videoFileId: data.videoFileId,
    status: "pending",
    submittedAt: new Date().toISOString(),
    metadata: {
      title: data.title
    }
  };

  const key = `queue:pending:${job.jobId}`;
  await ctx.env.JOB_QUEUE.put(key, JSON.stringify(job));

  console.log(`Job ${job.jobId} added to the queue.`);
  return job;
}


/**
 * Fetches a job from the queue by its ID and current status.
 */
export async function getFromQueue(ctx: CustomContext, jobId: string, status: JobStatus): Promise<Job | null> {
  const key = `queue:${status}:${jobId}`;
  const value = await ctx.env.JOB_QUEUE.get(key);
  return value ? JSON.parse(value) : null;
}

/**
 * Updates a job's status by moving it to a new state prefix in KV.
 * This pattern prevents race conditions, as a job can only exist in one state at a time.
 */
export async function updateStatus(ctx: CustomContext, job: Job, newStatus: JobStatus): Promise<Job> {
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
}

/**
 * Completely removes a job from the queue upon successful completion.
 */
export async function removeFromQueue(ctx: CustomContext, jobId: string, status: JobStatus): Promise<void> {
  const key = `queue:${status}:${jobId}`;
  await ctx.env.JOB_QUEUE.delete(key);
  console.log(`Job ${jobId} removed from the queue.`);
}