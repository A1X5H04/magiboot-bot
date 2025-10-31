import { makeGitHubProvider } from "./providers/github.ts";
import * as queueRepository from "../../repositories/queue.ts";
import { sendStatusUpdate } from "../../lib/helpers.ts";
import { createTursoClient } from "../../lib/turso.ts";
import { JobQueueModel } from "../../types/models.ts";
import { JobMetadata } from "../../types/queue.ts";
import { CIProvider } from "../../types/ci.ts";

// --- CI Provider Configuration ---
const CI_PROVIDERS = [
    // makeCirrusProvider({ ... }),
    makeGitHubProvider({
        owner: "A1X5H04",
        repo: "magiboot-bot",
        ref: "master",
        workflowId: "process.yml",
        token: Deno.env.get("CI_GITHUB_TOKEN"),
    }),
];


function hashCode(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return Math.abs(hash); // Ensure it's a positive number
}


/**
 * Selects a provider using a stateless hashing algorithm
 * based on the job ID.
 */
async function selectNextAvailableProvider(jobId: string): Promise<CIProvider | null> {
    if (CI_PROVIDERS.length === 0) {
        return null;
    }

    const hash = hashCode(jobId)

    const index = hash % CI_PROVIDERS.length;
    const provider = CI_PROVIDERS[index];

    try {
        if (await provider.isAvailable()) {
            return provider;
        }
    } catch (err) {
        console.error(`[Orchestrator] Error checking availability for ${provider.id}:`, (err as Error).message);
    }

    // FALLBACK
    for (let i = 0; i < CI_PROVIDERS.length; i++) {
        if (i === index) continue; // Skip the one we already checked
        
        try {
            if (await CI_PROVIDERS[i].isAvailable()) {
                return CI_PROVIDERS[i];
            }
        } catch (err) {
             console.error(`[Orchestrator] Error checking availability for ${CI_PROVIDERS[i].id}:`, (err as Error).message);
        }
    }

    // All providers are unavailable
    return null;


}

export async function handleJob(jobId?: string) {
    const db = createTursoClient();

    let job: JobQueueModel | null = null;
    let jobMetadata: JobMetadata;
    let availableProvider: CIProvider | null = null;

    try {
        if (jobId) {
            job = await queueRepository.findJobForProcessing(db, jobId)
        } else {
            job = await queueRepository.findLastJobForProcessing(db)
        }
        

        if (!job) {
            console.warn(jobId ? `Job ${jobId} already locked.` : "No pending jobs found.");
            return;
        }

        jobMetadata = job.metadata as unknown as JobMetadata;

        availableProvider = await selectNextAvailableProvider(job.id);

        if (!availableProvider) {
            console.error("[Orchestrator] No available CI providers at this time.");
            await queueRepository.updateStatus(db, job.id, "pending");
            
            await sendStatusUpdate({
                status: "failed",
                message: "All processing workers are currently busy. Your request has been re-queued and will be tried again shortly.",
                job_id: job.id,
                tg_metadata: {
                    chatId: jobMetadata.message.chatId,
                    messageId: jobMetadata.message.messageId,
                }
            });
            return;
        }

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
                bootanim_config: jobMetadata.bootanim_config,
                tags: jobMetadata.tags
            })
        });

        if (!dispatchResult.success) {
            throw new Error(dispatchResult.message || "Failed to dispatch workflow.");
        }

        console.log(`[Orchestrator] Job ${job.id} dispatched successfully to ${availableProvider.id}.`);

    } catch (err) {
        console.error(`[Orchestrator] Failed to dispatch job ${jobId}:`, (err as Error).message);
        
        if (job) {
            await queueRepository.updateStatus(db, job.id, "pending");

            await sendStatusUpdate({
                status: "failed",
                message: "An error occurred while dispatching your job. It has been re-queued and will be tried again automatically.",
                job_id: job.id,
                tg_metadata: {
                    chatId: (job.metadata as unknown as JobMetadata).message.chatId,
                    messageId: (job.metadata as unknown as JobMetadata).message.messageId,
                }
            });
        }
    }
}