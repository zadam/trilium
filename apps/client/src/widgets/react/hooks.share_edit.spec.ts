import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ putWithSilentConflict: vi.fn() }));
vi.mock("../../services/server", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../services/server")>();
    const putWithSilentConflict = mocks.putWithSilentConflict;
    return { ...actual, default: { ...actual.default, putWithSilentConflict } };
});

import { saveOnShare } from "./hooks";

describe("saveOnShare", () => {
    const shareEdit = {
        version: "blob1", attachments: false, onSaveState: vi.fn(), onConflict: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        shareEdit.version = "blob1";
        (window as unknown as { glob: unknown }).glob = { isShare: true, shareEdit };
    });

    it("saves against the loaded version and adopts the saved one", async () => {
        mocks.putWithSilentConflict.mockResolvedValue({ blobId: "blob2" });

        expect(await saveOnShare("note", { content: "<p>x</p>" }, "component", vi.fn())).toBe(true);

        expect(mocks.putWithSilentConflict).toHaveBeenCalledWith(
            "notes/note/data", { content: "<p>x</p>", baseBlobId: "blob1" }, "component");
        expect(shareEdit.version).toBe("blob2");
    });

    it("hands a stale save to the page; its retry adopts the newer version", async () => {
        const stale = JSON.stringify({ stale: { blobId: "newer" } });
        mocks.putWithSilentConflict.mockRejectedValue(stale);
        const retry = vi.fn();

        expect(await saveOnShare("note", { content: "<p>x</p>" }, undefined, retry)).toBe(false);

        expect(shareEdit.version).toBe("blob1");
        expect(shareEdit.onConflict)
            .toHaveBeenCalledWith({ blobId: "newer" }, expect.any(Function));
        shareEdit.onConflict.mock.calls[0][1]();
        expect(shareEdit.version).toBe("newer");
        expect(retry).toHaveBeenCalled();
    });

    it("rethrows any other failure, and saves nothing off a shared page", async () => {
        mocks.putWithSilentConflict.mockRejectedValue("Network down");
        const save = () => saveOnShare("note", { content: "" }, undefined, vi.fn());
        await expect(save()).rejects.toBe("Network down");
        mocks.putWithSilentConflict.mockRejectedValue(JSON.stringify({ message: "no stale here" }));
        await expect(save()).rejects.toBeDefined();
        expect(shareEdit.onConflict).not.toHaveBeenCalled();

        (window as unknown as { glob: unknown }).glob = { isShare: true };
        expect(await saveOnShare("note", { content: "" }, undefined, vi.fn())).toBe(false);
    });
});
