import type { Config } from "https://esm.sh/@netlify/edge-functions";

import { createTursoClient } from "../../../src/lib/turso.ts";
import { getFilenameFromName } from "../../../src/lib/utils.ts";
import * as postRepo from "../../../src/repositories/post.ts";

interface CloudFile {
    id: number;
    original_filename: string;
    download_count: number;
}


export default async function handler(req: Request) {
    // // 1. Secure the function
    const secret = Deno.env.get("CRON_SECRET");
    const auth = req.headers.get("Authorization");
    if (!secret || `Bearer ${secret}` !== auth) {
        console.warn("Unauthorized cron job access: sync-downloads");
        return new Response("Unauthorized", { status: 401 });
    }
    
    const db = createTursoClient();
    console.log("Starting download count sync...");

    try {
        // 2. Fetch from Cloudfam API
        const apiKey = Deno.env.get("STORAGE_PROVIDER_API_KEY");
        if (!apiKey) throw new Error("STORAGE_PROVIDER_API_KEY is not set");

        const cloudfamUrl = "https://cloudfam.io/api.php?action=view_files";
        const cloudfamResponse = await fetch(cloudfamUrl, {
            headers: { "X-API-Key": apiKey }
        });

        if (!cloudfamResponse.ok) {
            throw new Error(`Cloudfam API failed: ${cloudfamResponse.statusText}`);
        }

        const cloudfamData: { success: boolean; files: CloudFile[] } = await cloudfamResponse.json();
        if (!cloudfamData.success) {
            throw new Error("Cloudfam API reported failure.");
        }

        const cloudFileMap = new Map<string, number>();
        for (const file of cloudfamData.files) {
            cloudFileMap.set(file.original_filename, file.download_count);
        }

        console.log(`Fetched ${cloudFileMap.size} files from cloud storage.`);

        
        const localPosts = await postRepo.getAllPostsForSync(db);
        if (!localPosts) {
            console.log("No local posts found. Sync complete.");
            return new Response("OK: No local posts.", { status: 200 });
        }
        
        
        const updates: { id: number; newCount: number }[] = [];
        for (const post of localPosts) {
            
            const filenameKey = getFilenameFromName(post.name);
            
            const cloudCount = cloudFileMap.get(filenameKey);

            if (cloudCount !== undefined && cloudCount !== post.download_count) {
                // Found a difference!
                updates.push({ id: post.id, newCount: cloudCount });
            }
        }

        if (updates.length > 0) {
            await postRepo.batchUpdateDownloadCounts(db, updates);
            console.log(`Successfully synced ${updates.length} download counts.`);
        } else {
            console.log("All download counts are already in sync.");
        }

        return new Response(`✅ Sync complete. Updated ${updates.length} records.`, { status: 200 });

    } catch (err) {
        console.error("❌ Error in sync-downloads function:", err);
        return new Response(`Error: ${(err as Error).message}`, { status: 500 });
    }
}

export const config: Config = {
  path: "/bot/sync-downloads",
};