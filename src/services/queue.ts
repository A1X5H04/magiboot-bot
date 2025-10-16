// src/queue/queue.service.ts
import { JobStatus } from '../types/queue.ts';
import { createTursoClient } from "../lib/turso.ts";
import { JobQueueModel } from "../types/models.ts";
import * as queueRepository from "../repositories/queue.ts"

export interface CreateJobData {
    chatId: number;
    videoFileId: string;
    uniqueFileId: string;
    statusMessageId: number;
    title: string;
    videoRefMessageId: number;
    creator: {
        id: number;
        name: string;
    };
}

const db = createTursoClient()

export function addJob(data: CreateJobData): Promise<JobQueueModel | null> {
    return queueRepository.create(db, {
        message: {
            chatId: data.chatId,
            messageId: data.statusMessageId
        },
        creator: data.creator,
        file_id: data.videoFileId,
        unique_file_id: data.uniqueFileId,
        title: data.title,
        video_ref_message_id: data.videoRefMessageId
    });
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