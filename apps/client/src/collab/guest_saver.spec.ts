import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GuestSaver, type GuestSaveState } from "./guest_saver.js";

type FakeResponse = { ok: boolean; status: number; json: () => Promise<unknown> };

function reply(status: number, body: unknown = {}): FakeResponse {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function buildSaver(fetchMock: ReturnType<typeof vi.fn>, states: GuestSaveState[]) {
    return new GuestSaver({
        apiBase: "api/",
        noteId: "n1",
        blobId: "blob-0",
        csrfToken: "csrf",
        componentId: "collab-x",
        delayMs: 100,
        retryMs: 200,
        fetch: fetchMock as unknown as typeof fetch,
        onState: (state) => states.push(state)
    });
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>, call: number) {
    const [ url, init ] = fetchMock.mock.calls[call] as [ string, RequestInit ];

    return {
        url,
        headers: init.headers as Record<string, string>,
        body: JSON.parse(String(init.body))
    };
}

describe("GuestSaver", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("debounces edits into one save naming the loaded blob and adopts the new one", async () => {
        const fetchMock = vi.fn(async () => reply(200, { blobId: "blob-1" }));
        const states: GuestSaveState[] = [];
        const saver = buildSaver(fetchMock, states);

        saver.scheduleContent(() => "<p>a</p>");
        saver.scheduleContent(() => "<p>ab</p>");
        expect(fetchMock).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(100);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const { url, headers, body } = sentBody(fetchMock, 0);
        expect(url).toBe("api/notes/n1/content");
        expect(headers["x-csrf-token"]).toBe("csrf");
        expect(headers["trilium-component-id"]).toBe("collab-x");
        expect(body).toEqual({ content: "<p>ab</p>", baseBlobId: "blob-0" });
        expect(saver.currentBlobId).toBe("blob-1");
        expect(states).toEqual([ "pending", "pending", "saving", "saved" ]);
    });

    it("sends the preview of the content it saves, and saves without one that fails", async () => {
        const fetchMock = vi.fn(async () => reply(200, { blobId: "blob-1" }));
        const saver = buildSaver(fetchMock, []);
        const drawn: string[] = [];
        saver.preview = async (content) => {
            drawn.push(content);
            return `<svg>${content}</svg>`;
        };

        saver.scheduleContent(() => "graph TD");
        await saver.flush();
        expect(drawn).toEqual([ "graph TD" ]);
        expect(sentBody(fetchMock, 0).body).toEqual({
            content: "graph TD", baseBlobId: "blob-0", preview: "<svg>graph TD</svg>"
        });

        // A title alone carries no preview, and a preview that fails leaves the content to save.
        saver.scheduleTitle(() => "T");
        await saver.flush();
        expect(sentBody(fetchMock, 1).body).toEqual({ title: "T" });
        saver.preview = async () => {
            throw new Error("Could not draw.");
        };
        saver.scheduleContent(() => "graph LR");
        await saver.flush();
        expect(sentBody(fetchMock, 2).body).toEqual({ content: "graph LR", baseBlobId: "blob-1" });
        expect(saver.state).toBe("saved");
    });

    it("saves the title first and sends edits made during a request afterwards", async () => {
        const fetchMock = vi.fn(async (url: string) =>
            url.endsWith("/title") ? reply(200, { title: "T" }) : reply(200, { blobId: "blob-1" }));
        const saver = buildSaver(fetchMock, []);

        saver.scheduleTitle(() => "T");
        saver.scheduleContent(() => "<p>one</p>");
        const flushing = saver.flush();
        saver.scheduleContent(() => "<p>two</p>");
        await flushing;

        expect(sentBody(fetchMock, 0).url).toBe("api/notes/n1/title");
        expect(sentBody(fetchMock, 1).body.content).toBe("<p>one</p>");

        await vi.advanceTimersByTimeAsync(100);

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(sentBody(fetchMock, 2).body)
            .toEqual({ content: "<p>two</p>", baseBlobId: "blob-1" });
    });

    it("stops on a conflict until the guest takes their version or overwrites it", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(reply(409, { blobId: "blob-theirs", content: "<p>theirs</p>" }))
            .mockResolvedValue(reply(200, { blobId: "blob-2" }));
        const states: GuestSaveState[] = [];
        const saver = buildSaver(fetchMock, states);

        saver.scheduleContent(() => "<p>mine</p>");
        await vi.advanceTimersByTimeAsync(100);

        expect(saver.state).toBe("conflict");
        expect(saver.conflict).toEqual({ blobId: "blob-theirs", content: "<p>theirs</p>" });

        // Nothing goes out while the conflict stands.
        saver.scheduleContent(() => "<p>mine again</p>");
        await vi.advanceTimersByTimeAsync(500);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await saver.overwrite(() => "<p>mine wins</p>");

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(sentBody(fetchMock, 1).body)
            .toEqual({ content: "<p>mine wins</p>", baseBlobId: "blob-theirs" });
        expect(saver.currentBlobId).toBe("blob-2");
        expect(saver.conflict).toBeNull();
    });

    it("lets the guest take the server's version and continue from its blob", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(reply(409, { blobId: "blob-theirs", content: "<p>theirs</p>" }))
            .mockResolvedValue(reply(200, { blobId: "blob-3" }));
        const saver = buildSaver(fetchMock, []);

        saver.scheduleContent(() => "<p>mine</p>");
        await vi.advanceTimersByTimeAsync(100);
        saver.acceptServerVersion();

        expect(saver.state).toBe("idle");
        expect(saver.currentBlobId).toBe("blob-theirs");

        saver.scheduleContent(() => "<p>theirs plus mine</p>");
        await vi.advanceTimersByTimeAsync(100);

        expect(sentBody(fetchMock, 1).body)
            .toEqual({ content: "<p>theirs plus mine</p>", baseBlobId: "blob-theirs" });
    });

    it("retries after a failed request with what the editor holds by then", async () => {
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValue(reply(200, { blobId: "blob-4" }));
        const states: GuestSaveState[] = [];
        const saver = buildSaver(fetchMock, states);
        let text = "<p>first</p>";

        saver.scheduleContent(() => text);
        await vi.advanceTimersByTimeAsync(100);
        expect(saver.state).toBe("error");

        text = "<p>second</p>";
        await vi.advanceTimersByTimeAsync(200);

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(sentBody(fetchMock, 1).body.content).toBe("<p>second</p>");
        expect(saver.state).toBe("saved");
    });

    it("saves pending edits before switching the type, and reports the answer", async () => {
        const fetchMock = vi.fn().mockResolvedValue(reply(200, { blobId: "blob-5" }));
        const saver = buildSaver(fetchMock, []);
        saver.scheduleContent(() => "<p>typed</p>");

        expect(await saver.switchType("code", "text/x-python")).toBe(true);
        expect(sentBody(fetchMock, 0).url).toBe("api/notes/n1/content");
        expect(sentBody(fetchMock, 1)).toMatchObject({
            url: "api/notes/n1/type",
            body: { type: "code", mime: "text/x-python" }
        });

        fetchMock.mockResolvedValueOnce(reply(400));
        expect(await saver.switchType("code", "text/jsx")).toBe(false);
    });

    it("saves the open note before switching, and stays put while a conflict waits", async () => {
        const fetchMock = vi.fn().mockResolvedValue(reply(200, { blobId: "blob-a1" }));
        const saver = buildSaver(fetchMock, []);
        let text = "<p>typed in n1</p>";
        saver.scheduleContent(() => text);

        expect(await saver.switchNote("n2", "blob-b0")).toBe(true);
        expect(sentBody(fetchMock, 0)).toMatchObject({
            url: "api/notes/n1/content",
            body: { content: "<p>typed in n1</p>", baseBlobId: "blob-0" }
        });
        expect(saver.state).toBe("idle");
        expect(saver.currentBlobId).toBe("blob-b0");

        text = "<p>typed in n2</p>";
        saver.scheduleContent(() => text);
        await vi.advanceTimersByTimeAsync(100);
        expect(sentBody(fetchMock, 1)).toMatchObject({
            url: "api/notes/n2/content",
            body: { content: "<p>typed in n2</p>", baseBlobId: "blob-b0" }
        });

        // A conflict keeps the saver on its note until the guest settles it.
        fetchMock.mockResolvedValueOnce(reply(409, { blobId: "blob-x", content: "<p>theirs</p>" }));
        saver.scheduleContent(() => "<p>again</p>");
        await vi.advanceTimersByTimeAsync(100);
        expect(saver.conflict).not.toBeNull();
        expect(await saver.switchNote("n3", "blob-c0")).toBe(false);
        expect(saver.state).toBe("conflict");
    });
});
