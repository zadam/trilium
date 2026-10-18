import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ getRenderedContent: vi.fn() }));

vi.mock("../../../services/content_renderer", () => ({
    default: { getRenderedContent: h.getRenderedContent }
}));

import Component from "../../../components/component";
import froca from "../../../services/froca";
import { trackPendingRender } from "../../../services/pending_renders";
import { buildNote } from "../../../test/easy-froca";
import { renderInto } from "../../../test/render";
import { ListPrintView } from "./ListPrintView";

afterEach(() => {
    h.getRenderedContent.mockReset();
});

describe("ListPrintView", () => {
    it("mounts a render note's output and waits for its script before reporting ready", async () => {
        buildNote({ id: "root", title: "root", children: [ {
            id: "list-print", title: "Collection", type: "book",
            children: [ { id: "list-print-render", title: "Dashboard", type: "render" } ]
        } ] });
        const collection = froca.getNoteFromCache("list-print");
        if (!collection) throw new Error("expected the collection note");

        let finishScript: () => void = () => {};
        h.getRenderedContent.mockImplementation(async () => {
            const contentEl = document.createElement("div");
            trackPendingRender(contentEl, new Promise<void>((resolve) => {
                finishScript = () => {
                    contentEl.insertAdjacentHTML("beforeend", "<p class='late'>Script output</p>");
                    resolve();
                };
            }));
            return { $renderedContent: [ contentEl ] };
        });

        const onReady = vi.fn();
        const container = renderInto(
            <ListPrintView
                note={collection} notePath="root/list-print" noteIds={[ "list-print-render" ]}
                highlightedTokens={null} viewConfig={undefined} saveConfig={() => {}}
                media="print" onReady={onReady}
            />
        );

        await vi.waitFor(() => expect(h.getRenderedContent).toHaveBeenCalledOnce());
        expect(h.getRenderedContent.mock.calls[0]?.[1]?.parentComponent).toBeInstanceOf(Component);
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(onReady).not.toHaveBeenCalled();

        finishScript();
        await vi.waitFor(() => expect(onReady).toHaveBeenCalledOnce());
        expect(container.querySelector("#note-list-print-render .late")?.textContent).toBe("Script output");
    });
});
