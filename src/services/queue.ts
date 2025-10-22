// src/queue/queue.service.ts
import { JobMetadata, JobStatus } from '../types/queue.ts';
import { createTursoClient } from "../lib/turso.ts";
import { JobQueueModel } from "../types/models.ts";
import * as queueRepository from "../repositories/queue.ts"

const db = createTursoClient()

export function addJob(data: JobMetadata): Promise<JobQueueModel | null> {
    const res = queueRepository.create(db, data);
    return res;
}

export function getJobById(jobId: string): Promise<JobQueueModel | null> {
    return queueRepository.findById(db, jobId);
}

export function updateJobStatus(jobId: string, status: JobStatus): Promise<JobQueueModel> {
    const job = getJobById(jobId);

    if (!job) {
        throw new Error("Job not found");
    }

    return queueRepository.updateStatus(db, jobId, status);
}

export function getNextJob(): Promise<JobQueueModel | null> {
    return queueRepository.findOldestByStatus(db, 'processing');
}