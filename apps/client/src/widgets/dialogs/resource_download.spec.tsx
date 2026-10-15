import type { ResourceDownloadProgress, ResourcesStatusResponse, WebSocketMessage } from "@triliumnext/commons";
import { act } from "preact/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Component from "../../components/component";
import { renderInto } from "../../test/render";
import { ParentComponent } from "../react/react_utils";
import ResourceDownloadDialog from "./resource_download";

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    handlers: new Set<(message: WebSocketMessage) => void>()
}));

vi.mock("../../services/i18n", () => ({
    t: (key: string, values?: object) => (values ? `${key}:${JSON.stringify(values)}` : key)
}));
vi.mock("../../services/server", () => ({
    default: { get: vi.fn(async () => []), post: mocks.post }
}));
vi.mock("../../services/ws", () => {
    const ws = {
        subscribeToMessages: (handler: (message: WebSocketMessage) => void) => mocks.handlers.add(handler),
        unsubscribeToMessage: (handler: (message: WebSocketMessage) => void) => mocks.handlers.delete(handler)
    };
    return { default: ws, ...ws };
});

const STATUS: ResourcesStatusResponse = {
    resources: [ {
        id: "transcription.model",
        title: "Speech recognition model",
        description: "Transcribes meetings",
        icon: "bx bx-captions",
        size: 700,
        downloadedSize: 200,
        sources: [ "huggingface.co", "github.com" ],
        installed: false
    } ],
    freeBytes: 10_000,
    download: null
};

describe("ResourceDownloadDialog", () => {
    let host: Component;
    let container: HTMLElement;
    let results: boolean[];

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.handlers.clear();
        results = [];
        host = new Component();
        container = renderInto(
            <ParentComponent.Provider value={host}>
                <ResourceDownloadDialog />
            </ParentComponent.Provider>
        );
    });

    it("describes what it downloads, and resolves once the download succeeds", async () => {
        mocks.post.mockResolvedValue(progress({ receivedBytes: 200 }));
        await open();

        const row = container.querySelector(".resource-download-item");
        expect(row?.querySelector(".resource-download-icon")?.classList).toContain("bx-captions");
        expect(row?.textContent).toContain("Speech recognition model");
        expect(text(".resource-download-meta")).toContain("huggingface.co, github.com");
        expect(text(".resource-download-meta")).toContain(`"size":"200 B"`);
        expect(text(".resource-download-item .resource-download-size")).toBe("700 B");
        expect(text(".resource-download-total .resource-download-size")).toBe("500 B");
        expect(text(".resource-download-total")).toContain(`free_space:{"size":"9.77 KiB"}`);
        expect(container.querySelector(".admonition")).toBeNull();

        await click("resource_download.download");
        expect(mocks.post).toHaveBeenCalledExactlyOnceWith("resources/download",
            { ids: [ "transcription.model" ] });
        expect(container.querySelector("progress")?.value).toBe(200);

        await send(progress({ receivedBytes: 600, file: "encoder.int8.onnx" }));
        expect(container.querySelector("progress")?.value).toBe(600);
        expect(text(".resource-download-progress")).toContain("encoder.int8.onnx");

        await send(progress({ status: "succeeded", receivedBytes: 700 }));
        await hidden();
        expect(results).toEqual([ true ]);
    });

    it("keeps an end reported before the request that started the download returns", async () => {
        let respond = (_value: ResourceDownloadProgress) => {};
        mocks.post.mockReturnValue(new Promise((resolve) => respond = resolve));
        await open();

        await click("resource_download.download");
        await send(progress({ status: "failed", error: "checksum" }));
        await act(async () => respond(progress()));

        expect(text(".admonition.caution")).toContain("checksum");
        expect(findButton("resource_download.retry")).toBeDefined();
    });

    it("refuses to start a download that cannot fit in the free space", async () => {
        await open({ ...STATUS, freeBytes: 100 });

        expect(text(".admonition.caution")).toContain(`"size":"500 B","free":"100 B"`);
        expect(findButton("resource_download.download")?.disabled).toBe(true);
    });

    it("cancels the running download when closed, and resolves false", async () => {
        mocks.post.mockResolvedValue(progress());
        await open();
        await click("resource_download.download");
        expect(findButton("resource_download.download")).toBeUndefined();

        await hidden();

        expect(mocks.post).toHaveBeenLastCalledWith("resources/download/d1/cancel");
        expect(results).toEqual([ false ]);
    });

    async function open(status = STATUS) {
        await act(async () => {
            await host.handleEvent("showResourceDownloadDialog", {
                ids: [ "transcription.model" ],
                status,
                callback: (installed: boolean) => results.push(installed)
            });
        });
    }

    async function send(download: ResourceDownloadProgress) {
        await act(async () => {
            for (const handler of mocks.handlers) {
                handler({ type: "resource-download", download });
            }
        });
    }

    async function click(label: string) {
        const button = findButton(label);
        expect(button).toBeDefined();
        await act(async () => button?.click());
    }

    /** Bootstrap fires this when the dialog closes; the test sends it instead. */
    async function hidden() {
        const dialog = container.querySelector(".resource-download-dialog");
        expect(dialog).not.toBeNull();
        await act(async () => {
            dialog?.dispatchEvent(new Event("hidden.bs.modal", { bubbles: true }));
        });
    }

    function text(selector: string) {
        return container.querySelector(selector)?.textContent ?? "";
    }

    function findButton(label: string) {
        return [ ...container.querySelectorAll("button") ]
            .find((candidate) => candidate.textContent?.includes(label));
    }
});

function progress(overrides: Partial<ResourceDownloadProgress> = {}): ResourceDownloadProgress {
    return {
        downloadId: "d1",
        resourceIds: [ "transcription.model" ],
        status: "downloading",
        receivedBytes: 0,
        totalBytes: 700,
        file: null,
        ...overrides
    };
}
