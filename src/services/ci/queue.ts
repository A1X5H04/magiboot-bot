import { Job, JobStatus } from "../../types/ci";
import { generateRandomId } from "../../lib/generators";
import type { Env } from "../../types/cloudflare";

interface JobData {
    chatId: number;
    videoFileId: string;
    statusMessageId: number;
    title: string
    videoRefMessageId: number
    creator: {
        id: number;
        name: string;
    }
}


export async function addJobtoQueue(env: Env, data: JobData) {

    const timestampDate = Date.now();

    const job: Job = {
        jobId: generateRandomId(),
        chatId: data.chatId,
        status: "pending",
        statusMessageId: data.statusMessageId,
        fileId: data.videoFileId,
        submittedAt: new Date(timestampDate).toISOString(),
        retries: 0,
        metadata: {
            title: data.title,
            creator: {
                name: data.creator.name,
                id: data.creator.id
            },
            video_ref_message_id: data.videoRefMessageId
        }
    };

    await Promise.all([
        env.JOB_QUEUE.put(`job:${job.jobId}`, JSON.stringify(job)),
        env.JOB_QUEUE.put(`queue:${Date.now()}:${job.jobId}`, "1")
    ])

    console.log(`Job ${job.jobId} added to the queue.`);

    return job;
}


export async function updateJobStatus(env: Env, jobId: string, newStatus: JobStatus) {
    const job = await env.JOB_QUEUE.get(`job:${jobId}`);

    if (!job) {
        throw new Error("Job not found");
    }

    const newJob: Job = JSON.parse(job);

    newJob.status = newStatus;
    if (newStatus === "processing") { newJob.processedAt = new Date().toISOString(); }
    if (newStatus === "completed") {
        newJob.completedAt = new Date().toISOString();
        await env.JOB_QUEUE.put(`job:${jobId}`, JSON.stringify(newJob));
        await env.JOB_QUEUE.delete(`queue:${newJob.submittedAt}:${jobId}`);

        console.log(`Status updated to ${newStatus} for job ${jobId}.`)
        return newJob;
    }

    await env.JOB_QUEUE.put(`job:${jobId}`, JSON.stringify(newJob));

    console.log(`Status updated to ${newStatus} for job ${jobId}.`);
    return newJob;
}

export async function getFirstJob(env: Env, status: JobStatus): Promise<Job | null> {
    let cursor: string | undefined = undefined;
    
    do {

        // @ts-ignore
        const listResults = await env.JOB_QUEUE.list({
            prefix: "queue:",
            limit: 100, // Process in batches of 100
            cursor: cursor,
        });

        for (const key of listResults.keys) {
            const jobId = key.name.split(':')[2];
            const jobData = await env.JOB_QUEUE.get(`job:${jobId}`);

            if (jobData) {
                const job: Job = JSON.parse(jobData);
                if (job.status === status) {
                    console.dir(job)
                    return job; // Found the oldest match
                }
            }
        }
        cursor = listResults.cursor;
    } while (cursor);

    return null; // No matching job found in the entire queue
}


export async function getJobById(env: Env, jobId: string): Promise<Job | null> {
    const job = await env.JOB_QUEUE.get(`job:${jobId}`);

    if (!job) {
        return null;
    }

    return JSON.parse(job);
}


export async function updateJob(env: Env, jobId: string, newJob: Job) {
    const job = await env.JOB_QUEUE.get(`job:${jobId}`);

    if (!job) {
        throw new Error("Job not found");
    }

    await env.JOB_QUEUE.put(`job:${jobId}`, JSON.stringify(newJob));
}