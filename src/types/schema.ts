import { InferInput } from "https://esm.sh/valibot@1.1.0";

import { statusUpdateSchema, postMetadataSchema } from "../schema/webhook-status.ts";

export type StatusUpdate = InferInput<typeof statusUpdateSchema>;
export type PostMetadata = InferInput<typeof postMetadataSchema>;