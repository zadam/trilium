import { isLocalApiRequest, localFetch } from "./local-bridge.js";
import { toBase64 } from "./services/capacitor_download.js";

/**
 * Page side of `TriliumRequestBridge.java`, which answers local API requests in the Android shell
 * in place of the service worker.
 *
 * `WebViewClient.shouldInterceptRequest` sees every request the WebView issues, whichever part of
 * the engine issued it (`fetch`, XHR, `<img>`, `@font-face`, iframes, media). For a local API path
 * the native side calls `window.__triliumNativeRequest()`, this module answers it from
 * `localFetch()`, and the reply travels back over the `window.triliumRequestBridge` message
 * channel:
 *
 * - `{"type":"head","id","status","headers"}`, then the body as ArrayBuffer frames, each a 4-byte
 *   big-endian request id followed by the bytes — or, when the WebView cannot carry ArrayBuffers,
 *   `{"type":"chunk","id","data"}` with the bytes in base64.
 * - `{"type":"end","id"}` once the body is complete, or `{"type":"error","id","message"}`.
 *
 * `shouldInterceptRequest` exposes no request body, so the native side forwards only GET and HEAD.
 */
export function installAndroidRequestBridge() {
    const bridgeWindow = window as RequestBridgeWindow;
    const channel = bridgeWindow.triliumRequestBridge;
    if (!channel) {
        return;
    }

    bridgeWindow.__triliumNativeRequest = (request) => {
        void answer(channel, request);
    };
    // The native side holds every request it intercepted until this arrives.
    channel.postMessage(JSON.stringify({ type: "ready" }));
}

/** Request forwarded by `TriliumRequestBridge.java`. */
interface NativeRequest {
    id: number;
    method: string;
    url: string;
    headers: Record<string, string>;
    /** Whether the WebView carries ArrayBuffer messages; base64 chunks are sent otherwise. */
    binary: boolean;
}

interface RequestChannel {
    postMessage(message: string | ArrayBuffer): void;
}

interface RequestBridgeWindow {
    triliumRequestBridge?: RequestChannel;
    __triliumNativeRequest?: (request: NativeRequest) => void;
}

/** Bounds each message, so no single bridge crossing holds a whole attachment. */
const CHUNK_SIZE = 256 * 1024;

const FRAME_HEADER_SIZE = 4;

async function answer(channel: RequestChannel, request: NativeRequest) {
    const send = (message: Record<string, unknown>) =>
        channel.postMessage(JSON.stringify({ ...message, id: request.id }));

    try {
        const url = new URL(request.url, location.href);
        if (!isLocalApiRequest(url)) {
            // The prefix list in TriliumRequestBridge.java must match `isLocalApiRequest()`.
            throw new Error(`Path is not routed to the local worker: ${url.pathname}`);
        }

        const response = toNativeResponse(await localFetch(new Request(url.href, {
            method: request.method,
            headers: request.headers
        })));
        const body = new Uint8Array(await response.arrayBuffer());

        send({ type: "head", status: response.status, headers: Object.fromEntries(response.headers) });
        for (let offset = 0; offset < body.length; offset += CHUNK_SIZE) {
            const chunk = body.subarray(offset, offset + CHUNK_SIZE);
            if (request.binary) {
                channel.postMessage(frame(request.id, chunk));
            } else {
                send({ type: "chunk", data: toBase64(chunk) });
            }
        }
        send({ type: "end" });
    } catch (err) {
        console.warn("[RequestBridge] Local request failed", request.url, err);
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
    }
}

/**
 * `WebResourceResponse` rejects 3xx statuses, so a redirect (the share pages issue them) becomes a
 * page that navigates to its target. A relative target resolves against the request URL, as it
 * would for a real redirect.
 */
function toNativeResponse(response: Response): Response {
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) {
        return response;
    }

    const target = location.replaceAll("&", "&amp;").replaceAll("\"", "&quot;");
    return new Response(`<!DOCTYPE html><meta http-equiv="refresh" content="0;url=${target}">`, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" }
    });
}

function frame(id: number, chunk: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(FRAME_HEADER_SIZE + chunk.length);
    new DataView(buffer).setUint32(0, id);
    new Uint8Array(buffer, FRAME_HEADER_SIZE).set(chunk);
    return buffer;
}
