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
        license: "CC-BY-4.0",
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
        expect(text(".resource-download-license"))
            .toBe(`resource_download.license:{"license":"CC-BY-4.0"}`);
        expect(text(".resource-download-meta")).toContain(`"size":"200 B"`);
        expect(text(".resource-download-item .resource-download-size")).toBe("700 B");
        expect(text(".resource-download-total .resource-download-size")).toBe("500 B");
        expect(text(".resource-download-total")).toContain(`free_space:{"size":"9.77 KiB"}`);
        expect(container.querySelector(".admonition")).toBeNull();

        await click("resource_download.download");
        expect(mocks.post).toHaveBeenCalledExactlyOnceWith("resources/download",
            { ids: [ "transcription.model" ] });
        expect(row?.querySelector(".resource-download-icon")?.classList).toContain("bx-loader-circle");
        expect(row?.querySelector("[role=progressbar]")?.getAttribute("aria-valuenow")).toBe("200");

        await send(progress({ receivedBytes: 600, file: "encoder.int8.onnx" }));
        expect(row?.querySelector("[role=progressbar]")?.getAttribute("aria-valuenow")).toBe("600");
        expect(row?.querySelector(".resource-download-progress")?.textContent)
            .toContain("encoder.int8.onnx");

        await send(progress({ status: "succeeded", receivedBytes: 700 }));
        await hidden();
        expect(results).toEqual([ true ]);
    });

    it("marks each resource done as the download moves on, the one downloading with its bar", async () => {
        const vad = { ...STATUS.resources[0], id: "transcription.vad", title: "VAD", downloadedSize: 0 };
        mocks.post.mockResolvedValue(progress());
        await open({ ...STATUS, resources: [ ...STATUS.resources, vad ] });
        await click("resource_download.download");

        await send(progress({ resources: [
            { id: "transcription.model", receivedBytes: 700, totalBytes: 700, done: true },
            { id: "transcription.vad", receivedBytes: 100, totalBytes: 700, done: false }
        ] }));
        const [ first, second ] = container.querySelectorAll(".resource-download-item");
        expect(first.querySelector(".resource-download-icon")?.classList).toContain("bx-check-circle");
        expect(first.querySelector("[role=progressbar]")).toBeNull();
        expect(second.querySelector(".resource-download-icon")?.classList).toContain("bx-loader-circle");
        expect(second.querySelector("[role=progressbar]")?.getAttribute("aria-valuenow")).toBe("100");

        await send(progress({ status: "failed", error: "offline", resources: [
            { id: "transcription.model", receivedBytes: 700, totalBytes: 700, done: true },
            { id: "transcription.vad", receivedBytes: 100, totalBytes: 700, done: false }
        ] }));
        expect(second.querySelector(".resource-download-icon")?.classList).toContain("bx-circle");
        expect(container.querySelector("[role=progressbar]")).toBeNull();
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
    const receivedBytes = overrides.receivedBytes ?? 0;
    return {
        downloadId: "d1",
        resourceIds: [ "transcription.model" ],
        status: "downloading",
        receivedBytes,
        totalBytes: 700,
        file: null,
        resources: [ {
            id: "transcription.model",
            receivedBytes,
            totalBytes: 700,
            done: overrides.status === "succeeded"
        } ],
        ...overrides
    };
}
