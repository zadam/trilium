import type { ResourceInfo, WebSocketMessage } from "@triliumnext/commons";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    resources: [] as ResourceInfo[],
    requests: 0,
    handlers: [] as ((message: WebSocketMessage) => void)[]
}));

vi.mock("../../../services/server", () => ({
    default: {
        get: async (url: string) => {
            if (url !== "resources") {
                return [];
            }
            mocks.requests++;
            return { resources: mocks.resources, freeBytes: null, download: null };
        }
    }
}));

vi.mock("../../../services/ws", () => {
    const ws = {
        subscribeToMessages: (handler: (message: WebSocketMessage) => void) => {
            mocks.handlers.push(handler);
        },
        unsubscribeToMessage: (handler: (message: WebSocketMessage) => void) => {
            mocks.handlers = mocks.handlers.filter((h) => h !== handler);
        }
    };
    return { ...ws, default: ws };
});

vi.mock("../../../services/i18n", () => ({
    t: (key: string, args?: Record<string, string>) => args ? `${key} ${JSON.stringify(args)}` : key
}));

vi.mock("../../react/DirectoryLink", () => ({
    default: ({ directory }: { directory: string }) => <a className="directory-stub">{directory}</a>
}));

vi.mock("./components/OptionsPageHeader", () => ({ default: () => <div className="header-stub" /> }));

import ResourcesSettings from "./resources";

const MIB = 1024 * 1024;
let host: HTMLElement;

beforeEach(() => {
    mocks.resources = [
        resource({ id: "test.installed", installed: true, downloadedSize: 10 * MIB, directory: "/data/resources/test.installed-abc" }),
        resource({ id: "test.partial", downloadedSize: 4 * MIB }),
        resource({ id: "test.missing" })
    ];
    mocks.requests = 0;
    mocks.handlers = [];
    host = document.body.appendChild(document.createElement("div"));
});

afterEach(() => {
    act(() => render(null, host));
    document.body.innerHTML = "";
});

async function open() {
    await act(async () => {
        render(<ResourcesSettings />, host);
    });
}

describe("ResourcesSettings", () => {
    it("lists the resources installed or partly downloaded, with their status and folder", async () => {
        await open();

        const rows = [ ...host.querySelectorAll(".resources-item") ];
        expect(rows.map((row) => row.querySelector(".tn-card-option-title")?.textContent))
            .toEqual([ "test.installed", "test.partial" ]);
        expect(rows.map((row) => row.querySelector(".resources-status small")?.textContent)).toEqual([
            "resources_options.installed",
            `resources_options.partially_downloaded {"downloaded":"4.00 MiB","size":"10 MiB"}`
        ]);
        expect(rows.map((row) => row.querySelector(".directory-stub")?.textContent ?? null))
            .toEqual([ "/data/resources/test.installed-abc", null ]);
        expect(host.querySelector(".resources-total .resources-size")?.textContent).toBe("14 MiB");
    });

    it("shows an empty state when nothing is downloaded", async () => {
        mocks.resources = [ resource({ id: "test.missing" }) ];
        await open();

        expect(host.querySelector(".resources-item")).toBeNull();
        expect(host.textContent).toContain("resources_options.no_resources");
    });

    it("reads the resources again once a download ends, but not while it runs", async () => {
        await open();
        expect(mocks.requests).toBe(1);

        const send = async (status: "downloading" | "succeeded") => {
            await act(async () => {
                for (const handler of mocks.handlers) {
                    handler({ type: "resource-download", download: { status } } as WebSocketMessage);
                }
            });
        };
        await send("downloading");
        expect(mocks.requests).toBe(1);
        await send("succeeded");
        expect(mocks.requests).toBe(2);
    });
});

function resource(overrides: Partial<ResourceInfo> & { id: string }): ResourceInfo {
    return {
        title: overrides.id,
        description: "For tests",
        icon: "bx bx-test-tube",
        license: "MIT",
        size: 10 * MIB,
        downloadedSize: 0,
        sources: [ "example.com" ],
        installed: false,
        directory: null,
        ...overrides
    };
}
