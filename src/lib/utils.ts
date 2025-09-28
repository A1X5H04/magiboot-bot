import { JobStatus } from "../types/ci";
import { Env } from "../types/cloudflare";



type GetFileResponse = {
  ok: true;
  result: {
    file_id: string;
    file_unique_id: string;
    file_size: number;
    file_path: string;
  }
} | {
  ok: false;
  error_code: number;
  description: string;
}


export async function getFileInfo (env: Env, fileId: string) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/getFile?file_id=${fileId}`;

  const res = await fetch(url);

  if (!res.ok) throw new Error(`Failed to get file Info: ${res.status}`);

  const data = await res.json<GetFileResponse>();

  if (!data.ok) {
    throw new Error(`Failed to get file Info: ${data.description}`);
  }

  return data.result;
}

type UpdateMetadata = {
  chatId: string;
  userId: string;
  statusMessageId: number;
}