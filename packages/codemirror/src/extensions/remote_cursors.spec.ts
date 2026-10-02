import { history, undo, undoDepth } from "@codemirror/commands";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";

import {
    applyRemoteChanges, getLocalCodeSelection, type RemoteCodeCursor, setRemoteCursors
} from "./remote_cursors.js";

const GRACE = { id: "p1", name: "Grace", color: "#2066df" };
const ALAN = { id: "p2", name: "Alan", color: "#d22a1e" };

let view: EditorView | undefined;

afterEach(() => {
    view?.destroy();
    view = undefined;
});

function editor(doc: string) {
    view = new EditorView({ doc, parent: document.body });
    return view;
}

function at(offset: number, person = GRACE): RemoteCodeCursor {
    return { ...person, anchor: offset, head: offset };
}

function carets(target: EditorView) {
    return [ ...target.contentDOM.querySelectorAll<HTMLElement>(".cm-collab-caret") ];
}

/** The text the editor shows before the caret of the person with this name. */
function textBefore(target: EditorView, name: string) {
    const caret = carets(target).find((element) => element.textContent === name);
    if (!caret) throw new Error(`no caret for ${name}`);
    const range = document.createRange();
    range.setStart(target.contentDOM, 0);
    range.setEndBefore(caret);
    const text = range.cloneContents();
    for (const other of text.querySelectorAll(".cm-collab-caret")) {
        other.remove();
    }
    return text.textContent;
}

describe("remote cursors", () => {
    it("draws other people's carets and selections over the text, which stays as it is", () => {
        const target = editor("first line\nsecond line");

        setRemoteCursors(target, [ { ...GRACE, anchor: 11, head: 17 } ]);
        expect(target.state.doc.toString()).toBe("first line\nsecond line");
        expect(carets(target).map((caret) => caret.textContent)).toEqual([ "Grace" ]);
        expect(carets(target)[0].style.getPropertyValue("--collab-color")).toBe("#2066df");
        expect(carets(target)[0].classList.contains("cm-collab-caret-below")).toBe(false);
        expect(target.contentDOM.querySelector(".cm-collab-selection")?.textContent)
            .toBe("second");

        // On the first line the name goes below the caret; an offset past the end is the end.
        setRemoteCursors(target, [ at(3), at(999, ALAN) ]);
        expect(carets(target).map((caret) =>
            [ caret.textContent, caret.classList.contains("cm-collab-caret-below") ]))
            .toEqual([ [ "Grace", true ], [ "Alan", false ] ]);
        expect(textBefore(target, "Alan")).toBe("first linesecond line");
        expect(target.contentDOM.querySelector(".cm-collab-selection")).toBeNull();

        // The same cursors again keep their elements, so a name fades on its own schedule.
        const grace = carets(target)[0];
        setRemoteCursors(target, [ at(3), at(999, ALAN) ]);
        expect(carets(target)[0]).toBe(grace);

        // A cursor in anything but a plain color is left out.
        setRemoteCursors(target, [ { ...at(0), color: "red; background: url(x)" } ]);
        expect(carets(target)).toEqual([]);
    });

    it("moves the carets with the local edits until the next update", () => {
        const target = editor("hello world");
        setRemoteCursors(target, [ at(6) ]);

        target.dispatch({ changes: { from: 0, insert: ">> " } });

        expect(textBefore(target, "Grace")).toBe(">> hello ");
    });

    it("takes another person's edits around the caret, out of the undo history", () => {
        const target = new EditorView({ doc: "hello world", extensions: [ history() ],
            parent: document.body });
        view = target;
        target.dispatch({ selection: EditorSelection.cursor(6), userEvent: "select" });
        target.dispatch({ changes: { from: 11, insert: "!" }, userEvent: "input.type" });
        setRemoteCursors(target, [ at(5) ]);

        applyRemoteChanges(target, [
            { from: 0, to: 0, insert: ">> " }, { from: 6, to: 11, insert: "there" }
        ]);

        expect(target.state.doc.toString()).toBe(">> hello there!");
        // The caret was at the start of the replaced word, which keeps it before the new one.
        expect(getLocalCodeSelection(target)).toEqual({ anchor: 9, head: 9 });
        expect(textBefore(target, "Grace")).toBe(">> hello");
        // Undo reverts only the editor's own typing.
        expect(undoDepth(target.state)).toBe(1);
        undo(target);
        expect(target.state.doc.toString()).toBe(">> hello there");
    });

    it("reads the editor's own selection, its head where it ends", () => {
        const target = editor("hello world");

        target.dispatch({ selection: EditorSelection.range(8, 2) });

        expect(getLocalCodeSelection(target)).toEqual({ anchor: 8, head: 2 });
    });
});
