// src/queue/job.repository.ts
import { nanoid } from "https://esm.sh/nanoid";
import type { Client } from "https://esm.sh/@libsql/client/web";
import { JobQueueModel } from "../types/models.ts"
import { JobMetadata, JobStatus } from "../types/queue.ts";
import { mapToModel } from "../lib/utils.ts";

export async function create(client: Client, jobData: JobMetadata): Promise<JobQueueModel | null> {
    const jobId = nanoid();
    const rs = await client.execute({
        sql: "INSERT INTO queue_jobs (id, metadata, status) VALUES (?, ?, ?) RETURNING id",
        args: [
            jobId,
            JSON.stringify(jobData), // Store metadata as a JSON string
            "pending",
        ],
    });

    if (rs.rows.length === 0) {
        return null;
    }

    return mapToModel<JobQueueModel>(rs.rows[0])
}


export async function findById(client: Client, id: string): Promise<JobQueueModel | null> {
    const rs = await client.execute({
        sql: "SELECT * FROM queue_jobs WHERE id = ?",
        args: [id],
    });

    if (rs.rows.length === 0) {
        return null;
    }

    return mapToModel<JobQueueModel>(rs.rows[0]);
}


export async function updateStatus(client: Client, id: string, status: JobStatus): Promise<JobQueueModel> {
    const rs = await client.execute({
        // RETURNING * lets us get the updated row back in one query
        sql: "UPDATE queue_jobs SET status = ? WHERE id = ? RETURNING *",
        args: [status, id],
    });

    if (rs.rows.length === 0) {
        throw new Error(`Job with ID ${id} not found.`);
    }

    return mapToModel<JobQueueModel>(rs.rows[0]);
}

export async function findOldestByStatus(client: Client, status: JobStatus): Promise<JobQueueModel | null> {
    const rs = await client.execute({
        sql: "SELECT * FROM queue_jobs WHERE status = ? ORDER BY created_at ASC LIMIT 1",
        args: [status],
    });
        
    if (rs.rows.length === 0) {
        return null;
    }
    return mapToModel<JobQueueModel>(rs.rows[0]);
}