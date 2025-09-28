import { StatusUpdate } from "../types/schema";

export async function sendStatusUpdate(data: StatusUpdate) {
    const url = "https://unmilked-holily-contessa.ngrok-free.app/webhooks/status"

    const res = await fetch(url, { 
        method: "POST",
        body: JSON.stringify({
            status: data.status,
            message: data.message,
            tg_metadata: data.tg_metadata,
        })
    })

    if (!res.ok) {
        throw new Error(`Failed to send status update: ${res.status}`);
    }

    return await res.text();
}