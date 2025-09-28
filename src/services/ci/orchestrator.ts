import { CIProvider, Job } from "../../types/ci";
import type { Env } from "../../types/cloudflare";
import { sendStatusUpdate } from "../../lib/helpers";
import { getFileInfo } from "../../lib/utils";
import { makeGitHubProvider } from "./providers/github";
import { getFirstJob, getJobById, updateJob, updateJobStatus } from "./queue";


const getCIProviders = (env: Env): CIProvider[] => {
    return [
        makeGitHubProvider({
            owner: "A1X5H04",
            repo: "magiboot-bot",
            ref: "master",
            workflowId: "process.yml",
            token: env.GITHUB_TOKEN,
        }),
    ]
}

export async function handleJob(env: Env, jobId?: string) {

    const ciProviders = getCIProviders(env);

    // Find the first available CI provider.
    // In the future, this is where you'd put a load-balancing algorithm.
    let availableProvider: CIProvider | null = null;
    for (const provider of ciProviders) {
        if (await provider.isAvailable()) {
            availableProvider = provider;
            break; // Found one, stop looking.
        }
    }

    if (!availableProvider) {
        console.error("No available CI providers at this time.");
        return;
    }

    let job: Job | null = null;

    if (jobId) {
        job = await getJobById(env, jobId);
    } else {
        job = await getFirstJob(env, "pending");
    }

    if (!job) {
        console.warn(jobId ? `Job with id ${jobId} not found.` : "No pending job found.", "Failed to dispatch job");
        return;
    }

    await updateJobStatus(env, job.jobId, "processing");

    const dispatchResult = await availableProvider.triggerWorkflow({
        video: job.fileId,
        other_metadata: JSON.stringify({
            jobId: job.jobId,
            msg_metadata: {
                chatId: job.chatId,
                messageId: job.statusMessageId,
            },
            title: job.metadata.title,
            creator: job.metadata.creator,
            ref_message_id: job.metadata.video_ref_message_id,
        })
    });

    if (!dispatchResult.success) {
        console.log("Failed to dispatch job", job.jobId, dispatchResult.message);
        await sendStatusUpdate({
            status: "failed",
            message: "Your request failed to be processed, try again later.",
            tg_metadata: {
                chatId: job.chatId,
                messageId: job.statusMessageId,
            }
        });

    } else {
        console.log(`Job with id ${job.jobId} dispatched successfully.`);
    }

}