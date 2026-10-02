import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { describe, expect, it, vi } from "vitest";

// Excalidraw's bundle does not load under Node; the merge needs only its constants.
vi.mock("@excalidraw/excalidraw", () => ({ CaptureUpdateAction: { NEVER: "NEVER" } }));

import { mergeCanvasElements } from "./canvas_merge.js";

function element(id: string, version: number, extra: Record<string, unknown> = {}) {
    return { id, version, versionNonce: version, index: `a${id}`, ...extra } as unknown as
        ExcalidrawElement;
}

const ids = (elements: readonly ExcalidrawElement[]) =>
    elements.map((item) => `${item.id}@${item.version}${item.isDeleted ? "x" : ""}`);

describe("mergeCanvasElements", () => {
    it("keeps everyone's new and changed shapes, the newest version of each", () => {
        const base = [ element("1", 1), element("2", 1) ];
        const mine = [ element("1", 3), element("2", 1), element("3", 1) ];
        const theirs = [ element("1", 2), element("2", 5), element("4", 1) ];

        expect(ids(mergeCanvasElements(base, mine, theirs)))
            .toEqual([ "1@3", "2@5", "3@1", "4@1" ]);
    });

    it("drops a shape the other side deleted, unless this side changed it since", () => {
        const base = [ element("1", 1), element("2", 1), element("3", 1) ];
        // This side moved 2 and deleted 3, keeping it as Excalidraw does.
        const mine = [ element("1", 1), element("2", 2), element("3", 2, { isDeleted: true }) ];
        // The other side deleted 1 and 2 and changed 3; its content leaves deleted shapes out.
        const theirs = [ element("3", 2) ];

        expect(ids(mergeCanvasElements(base, mine, theirs))).toEqual([ "2@2", "3@2x" ]);
    });

    it("orders the shapes by their fractional index", () => {
        const merged = mergeCanvasElements([], [ element("b", 1, { index: "a2" }) ],
            [ element("a", 1, { index: "a1" }), element("c", 1, { index: "a3" }) ]);

        expect(merged.map((item) => item.id)).toEqual([ "a", "b", "c" ]);
    });
});
