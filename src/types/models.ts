import { JobStatus } from "./queue.ts";


// Model for Job Queue Table
export interface JobQueueModel<T = Record<string, unknown>> {
    id: string;
    status: JobStatus;
    metadata: T;
    created_at: string;
    updated_at: string;
}

// Model for Post Table
export interface PostModel {
    id: number;
    user_id: number;
    message_id: number;
    name: string;
    unique_file_id: string;
    download_url: string;
    tags: string;
    votes: number;
    download_count: number;
    created_at: string;
    updated_at: string;
}