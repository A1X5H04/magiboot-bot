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


    const failedOrPendingSchema = v.object({
        status: v.union([v.literal("failed"), v.literal("pending")]),
        message: v.string(),
        job_id: v.string(),
        tg_metadata: tgMetadataSchema,
        error_log_b64: v.optional(v.string()),
    });

    const processingSchema = v.object({
        status: v.literal("processing"),
        message: v.string(),
        progress: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
        tg_metadata: tgMetadataSchema,
    });

    const completedSchema = v.object({
        status: v.literal("completed"),
        message: v.string(),
        job_id: v.string(),
        post_metadata: postMetadataSchema,
        tg_metadata: tgMetadataSchema,
    });


    export const statusUpdateSchema = v.variant("status", [
        failedOrPendingSchema,
        processingSchema,
        completedSchema,
    ]);


