import {
    _setModelData as setModelData, type ClassicEditor, Essentials, Paragraph
} from "ckeditor5";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestEditor } from "../../test/editor-kit.js";
import CollabCursors, { type RemoteCursor } from "./collab_cursors.js";

const GRACE = { id: "p1", name: "Grace", color: "#2066df" };
const ALAN = { id: "p2", name: "Alan", color: "#d22a1e" };

describe("CollabCursors", () => {
    let editor: ClassicEditor;
    let plugin: CollabCursors;

    beforeEach(async () => {
        editor = await createTestEditor([ Essentials, Paragraph, CollabCursors ]);
        plugin = editor.plugins.get(CollabCursors);
    });

    function show(...cursors: RemoteCursor[]) {
        plugin.setRemoteCursors(cursors);
    }

    function at(path: number[], person = GRACE): RemoteCursor {
        return { ...person, anchor: path, head: path };
    }

    function domRoot() {
        const root = editor.editing.view.getDomRoot();
        if (!root) throw new Error("no editing root");
        return root;
    }

    function carets() {
        return [ ...domRoot().querySelectorAll<HTMLElement>(".ck-collab-caret") ];
    }

    /** The text the editor shows before the caret of the person with this name. */
    function textBefore(name: string) {
        const caret = carets().find((element) => element.textContent === name);
        if (!caret) throw new Error(`no caret for ${name}`);
        const range = document.createRange();
        range.setStart(domRoot(), 0);
        range.setEndBefore(caret);
        // CKEditor's inline filler, which it puts beside a caret at the start of a line.
        return range.toString().replace(/\u2060/g, "");
    }

    it("draws other people's carets and selections in the editing view alone", () => {
        setModelData(editor.model, "<paragraph>Hello wor[]ld</paragraph>");
        const undo = editor.commands.get("undo");
        undo?.clearStack();
        const dataChanges = vi.fn();
        editor.model.document.on("change:data", dataChanges);

        show({ ...GRACE, anchor: [ 0, 0 ], head: [ 0, 5 ] });

        const selection = domRoot().querySelector<HTMLElement>(".ck-collab-selection");
        expect(selection?.textContent).toBe("Hello");
        expect(selection?.style.getPropertyValue("--collab-color")).toBe("#2066df");
        expect(carets().map((caret) => caret.textContent)).toEqual([ "Grace" ]);
        expect(carets()[0].style.getPropertyValue("--collab-color")).toBe("#2066df");
        expect(textBefore("Grace")).toBe("Hello");

        expect(editor.getData()).toBe("<p>Hello world</p>");
        expect(dataChanges).not.toHaveBeenCalled();
        expect(undo?.isEnabled).toBe(false);

        // A cursor in a color that is not one leaves nothing behind.
        show({ ...ALAN, color: "red; background: url(x)", anchor: [ 0, 1 ], head: [ 0, 1 ] });
        expect(carets()).toEqual([]);
        expect(domRoot().querySelector(".ck-collab-selection")).toBeNull();
    });

    it("redraws only the people who moved or were renamed, and drops those who left", () => {
        setModelData(editor.model, "<paragraph>Hello world</paragraph>");

        show(at([ 0, 6 ]), at([ 0, 1 ], ALAN));
        expect(carets().map((caret) => caret.textContent)).toEqual([ "Alan", "Grace" ]);
        const grace = carets()[1];

        show(at([ 0, 6 ]), at([ 0, 2 ], ALAN));
        expect(carets()[1]).toBe(grace);
        expect(textBefore("Alan")).toBe("He");

        show(at([ 0, 6 ], { ...GRACE, name: "Grace Hopper" }));
        expect(carets().map((caret) => caret.textContent)).toEqual([ "Grace Hopper" ]);
        expect(textBefore("Grace Hopper")).toBe("Hello ");
    });

    it("puts a caret the content no longer has as near its place as the content allows", () => {
        setModelData(editor.model, "<paragraph>Hi</paragraph><paragraph>there</paragraph>");

        show(at([ 5, 40 ]));
        expect(textBefore("Grace")).toBe("Hithere");

        // A path that runs through text stops at the text.
        show(at([ 0, 1, 7 ]));
        expect(textBefore("Grace")).toBe("H");

        show(at([]));
        expect(textBefore("Grace")).toBe("");

        // A backward selection highlights the same text, with the caret where it ends.
        show({ ...GRACE, anchor: [ 1, 4 ], head: [ 1, 1 ] });
        expect(domRoot().querySelector(".ck-collab-selection")?.textContent).toBe("her");
        expect(textBefore("Grace")).toBe("Hit");
    });

    it("draws the carets again after the content is replaced", () => {
        setModelData(editor.model, "<paragraph>Hello</paragraph>");
        show({ ...GRACE, anchor: [ 0, 2 ], head: [ 0, 4 ] });

        editor.setData("<p>Goodbye world</p>");

        expect(textBefore("Grace")).toBe("Good");
        expect(domRoot().querySelector(".ck-collab-selection")?.textContent).toBe("od");
        expect(editor.getData()).toBe("<p>Goodbye world</p>");
    });

    it("reads this editor's selection as model paths, the head where the selection ends", () => {
        setModelData(editor.model, "<paragraph>Hel[lo</paragraph><paragraph>wo]rld</paragraph>");
        expect(plugin.getLocalSelection()).toEqual({ anchor: [ 0, 3 ], head: [ 1, 2 ] });

        setModelData(editor.model, "<paragraph>Hel[lo</paragraph><paragraph>wo]rld</paragraph>",
            { selectionAttributes: {}, lastRangeBackward: true });
        expect(plugin.getLocalSelection()).toEqual({ anchor: [ 1, 2 ], head: [ 0, 3 ] });
    });
});
