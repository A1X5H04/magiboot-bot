import * as v from 'https://esm.sh/valibot@1.1.0';


const tgMetadataSchema = v.object({
    messageId: v.number(),
    chatId: v.union([v.number(), v.string()]),
});

export const postMetadataSchema = v.object({
    title: v.string(),
    creator: v.object({
        user_id: v.number(),
        name: v.string(),
    }),
    tags: v.array(v.string()),
    download_url: v.pipe(v.string(), v.url()),
    preview_url: v.pipe(v.string(), v.url()),
    video: v.object({
        file_id: v.string(),
        file_unique_id: v.string(),
        ref_message_id: v.number(),
    }),
    details: v.object({
        resolution: v.object({
            module: v.string(),
            video: v.nullable(v.string()),
        }),
        fps: v.number(),
        duration: v.number(),
        type: v.string(),
    }),
});


const pendingOrProcessingSchema = v.object({
    status: v.union([v.literal("pending"), v.literal("processing")]),
    job_id: v.string(),
    tg_metadata: tgMetadataSchema,
});

const failedSchema = v.object({
    status: v.literal("failed"),
    message: v.string(),
    job_id: v.string(),
    tg_metadata: tgMetadataSchema,
    error_list: v.optional(v.array(v.string())),
});

const completedSchema = v.object({
    status: v.literal("completed"),
    job_id: v.string(),
    post_metadata: postMetadataSchema,
    tg_metadata: tgMetadataSchema,
});


export const statusUpdateSchema = v.variant("status", [
    pendingOrProcessingSchema,
    failedSchema,
    completedSchema,
]);


