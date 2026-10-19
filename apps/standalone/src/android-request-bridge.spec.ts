import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installAndroidRequestBridge } from "./android-request-bridge.js";

const mocks = vi.hoisted(() => ({
    localFetch: vi.fn()
}));

vi.mock("./local-bridge.js", () => ({
    localFetch: (request: Request) => mocks.localFetch(request),
    isLocalApiRequest: (url: URL) => url.pathname.startsWith("/api/") || url.pathname.startsWith("/share/")
}));

interface BridgeWindow {
    triliumRequestBridge?: { postMessage: ReturnType<typeof vi.fn> };
    __triliumNativeRequest?: (request: Record<string, unknown>) => void;
}

const bridgeWindow = window as unknown as BridgeWindow;
let postMessage: ReturnType<typeof vi.fn>;

beforeEach(() => {
    mocks.localFetch.mockReset();
    postMessage = vi.fn();
    bridgeWindow.triliumRequestBridge = { postMessage };
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    delete bridgeWindow.triliumRequestBridge;
    delete bridgeWindow.__triliumNativeRequest;
    vi.restoreAllMocks();
});

/** Installs the bridge, forwards one request, and returns every message the page sent back. */
async function forward(request: Record<string, unknown>) {
    installAndroidRequestBridge();
    postMessage.mockClear();
    bridgeWindow.__triliumNativeRequest?.({
        method: "GET",
        headers: {},
        binary: true,
        ...request
    });
    await vi.waitFor(() => {
        const last = postMessage.mock.calls.at(-1)?.[0];
        expect(typeof last === "string" && /"type":"(end|error)"/.test(last)).toBe(true);
    });
    return postMessage.mock.calls.map(([message]) =>
        typeof message === "string" ? JSON.parse(message) : message as ArrayBuffer);
}

describe("installAndroidRequestBridge", () => {
    it("does nothing without the native channel, and announces readiness with it", () => {
        delete bridgeWindow.triliumRequestBridge;
        installAndroidRequestBridge();
        expect(bridgeWindow.__triliumNativeRequest).toBeUndefined();

        bridgeWindow.triliumRequestBridge = { postMessage };
        installAndroidRequestBridge();
        expect(bridgeWindow.__triliumNativeRequest).toBeTypeOf("function");
        expect(postMessage).toHaveBeenCalledWith(JSON.stringify({ type: "ready" }));
    });

    it("answers from localFetch with a head, id-framed binary chunks and an end", async () => {
        // Two chunks' worth plus a remainder, so the split and the framing both show.
        const body = new Uint8Array(256 * 1024 * 2 + 3).map((_, i) => i % 251);
        mocks.localFetch.mockResolvedValue(new Response(body, {
            status: 206,
            headers: { "content-type": "image/png" }
        }));

        const messages = await forward({ id: 7, url: "https://localhost/api/images/x", headers: { range: "bytes=0-" } });

        const request = mocks.localFetch.mock.calls[0][0] as Request;
        expect(request.url).toBe("https://localhost/api/images/x");
        expect(request.method).toBe("GET");
        expect(request.headers.get("range")).toBe("bytes=0-");

        expect(messages[0]).toEqual({ type: "head", id: 7, status: 206, headers: { "content-type": "image/png" } });
        const frames = messages.slice(1, -1) as ArrayBuffer[];
        expect(frames.map((frame) => frame.byteLength)).toEqual([4 + 256 * 1024, 4 + 256 * 1024, 4 + 3]);
        for (const frame of frames) {
            expect(new DataView(frame).getUint32(0)).toBe(7);
        }
        const received = new Uint8Array(frames.flatMap((frame) => [...new Uint8Array(frame, 4)]));
        expect(received).toEqual(body);
        expect(messages.at(-1)).toEqual({ type: "end", id: 7 });
    });

    it("sends base64 chunks when the WebView cannot carry ArrayBuffers, and none for an empty body", async () => {
        mocks.localFetch.mockResolvedValue(new Response("hello"));
        const messages = await forward({ id: 3, url: "https://localhost/api/notes", binary: false });
        expect(messages.slice(1)).toEqual([
            { type: "chunk", id: 3, data: btoa("hello") },
            { type: "end", id: 3 }
        ]);

        mocks.localFetch.mockResolvedValue(new Response(null, { status: 204 }));
        const empty = await forward({ id: 4, url: "https://localhost/api/notes" });
        expect(empty.map((message) => (message as { type: string }).type)).toEqual(["head", "end"]);
    });

    it("turns a redirect into a page that navigates, since WebResourceResponse rejects 3xx", async () => {
        mocks.localFetch.mockResolvedValue(new Response(null, {
            status: 302,
            headers: { location: "../share/?a=1&b=\"2\"" }
        }));
        const messages = await forward({ id: 1, url: "https://localhost/share/x", binary: false });

        expect(messages[0]).toEqual({
            type: "head", id: 1, status: 200, headers: { "content-type": "text/html; charset=utf-8" }
        });
        const html = atob((messages[1] as { data: string }).data);
        expect(html).toBe("<!DOCTYPE html><meta http-equiv=\"refresh\" content=\"0;url=../share/?a=1&amp;b=&quot;2&quot;\">");
    });

    it("reports an error for a path the worker does not serve, and for a failed localFetch", async () => {
        const unrouted = await forward({ id: 5, url: "https://localhost/assets/app.js" });
        expect(unrouted).toEqual([{ type: "error", id: 5, message: "Path is not routed to the local worker: /assets/app.js" }]);
        expect(mocks.localFetch).not.toHaveBeenCalled();

        mocks.localFetch.mockRejectedValue(new Error("worker gone"));
        const failed = await forward({ id: 6, url: "https://localhost/api/notes" });
        expect(failed).toEqual([{ type: "error", id: 6, message: "worker gone" }]);
    });
});
