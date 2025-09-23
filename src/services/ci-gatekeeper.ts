// CI Gatekeeper

import { CustomContext } from "../types/context";
import { Job } from "../types/queue";
import { updateStatus } from "./queue";

export async function dispatchJob(ctx: CustomContext, job: Job): Promise<void> {
    if (job.status !== "pending") {
        throw new Error(`Job ${job.jobId} is not in pending state`);
    }

    await updateStatus(ctx, job, "processing");

    // TODO: Implement job processing logic

}
    
