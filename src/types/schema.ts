import { InferInput } from "valibot";

import { statusUpdateSchema, postMetadataSchema } from "../schema/webhook-status";

export type StatusUpdate = InferInput<typeof statusUpdateSchema>;
export type PostMetadata = InferInput<typeof postMetadataSchema>;