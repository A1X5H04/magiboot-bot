import { sendStatusUpdate } from "../../lib/helpers.ts";
import { JobQueueModel } from "../../types/models.ts";
import { JobMetadata } from "../../types/queue.ts";
import { getJobById, getNextJob, updateJobStatus } from "../queue.ts";
import { makeGitHubProvider } from "./providers/github.ts";
import { CIProvider } from "../../types/ci.ts";

const CI_PROVIDERS = [
        makeGitHubProvider({
            owner: "A1X5H04",
            repo: "magiboot-bot",
            ref: "master",
            workflowId: "process.yml",
            token: Deno.env.get("CI_GITHUB_TOKEN"),
        }),
    ]

export async function handleJob(jobId?: string) {

    // Find the first available CI provider.
    // In near future add load balancing algorithm.
    let availableProvider: CIProvider | null = null;
    for (const provider of CI_PROVIDERS) {
        if (await provider.isAvailable()) {
            availableProvider = provider;
            break; // Found one, stop looking.
        }
    }

    if (!availableProvider) {
        console.error("No available CI providers at this time.");
        return;
    }

    let job: JobQueueModel | null = null;

    if (jobId) {
        job = await getJobById(jobId);
    } else {
        job = await getNextJob();
    }

    if (!job) {
        console.warn(jobId ? `Job with id ${jobId} not found.` : "No pending job found.", "Failed to dispatch job");
        return;
    }

    await updateJobStatus(job.id, "processing");

    const jobMetadata = job.metadata as unknown as JobMetadata

    const dispatchResult = await availableProvider.triggerWorkflow({
        
        video: jobMetadata.file_id,
        other_metadata: JSON.stringify({
            jobId: job.id,
            msg_metadata: {
                chatId: jobMetadata.message.chatId,
                messageId: jobMetadata.message.messageId,
            },
            unique_file_id: jobMetadata.unique_file_id,
            title: jobMetadata.title,
            creator: jobMetadata.creator,
            ref_message_id: jobMetadata.video_ref_message_id,
        })
    });

    if (!dispatchResult.success) {
        console.log("Failed to dispatch job", job.id, dispatchResult.message);
        await sendStatusUpdate({
            status: "failed",
            message: "Your request failed to be processed, try again later.",
            job_id: job.id,
            tg_metadata: {
                chatId: jobMetadata.message.chatId,
                messageId: jobMetadata.message.messageId,
            }
        });

    } else {
        console.log(`Job with id ${job.id} dispatched successfully.`);
    }

}