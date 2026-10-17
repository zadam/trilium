import type { CKTextEditor } from "@triliumnext/ckeditor5";
import FindReveal from "@triliumnext/ckeditor5/src/plugins/find_reveal.js";
import {
    ClassicEditor, type Editor, Essentials, FindAndReplaceEditing, Paragraph
} from "ckeditor5";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type FindWidget from "./find";
import FindInText, { TextEditorFindTarget } from "./find_in_text";
import MergedFind, { type FindTarget } from "./merged_find";
import { registerEmbedFindTarget } from "./type_widgets/text/content_embed_tools";

const OPTIONS = { matchCase: false, wholeWord: false };
const CONTENT = "<p>needle one</p>"
    + "<figure class=\"include-note\"><figcaption>needle caption</figcaption></figure>"
    + "<p>needle two</p>";

let editor: ClassicEditor;
let cleanups: (() => void)[];

beforeEach(async () => {
    const element = document.createElement("div");
    document.body.append(element);
    editor = await ClassicEditor.create(element, {
        licenseKey: "GPL",
        plugins: [ Essentials, Paragraph, FindAndReplaceEditing, FindReveal, EmbedSchema ]
    });
    editor.setData(CONTENT);
    cleanups = [];
});

afterEach(async () => {
    for (const cleanup of cleanups) cleanup();
    if (editor.state !== "destroyed") await editor.destroy();
    document.body.replaceChildren();
});

describe("TextEditorFindTarget", () => {
    it("places the matches of an embed between the text before it and its caption", async () => {
        const embedTarget = registerEmbedTarget(2);
        const find = new MergedFind(new TextEditorFindTarget(asTextEditor(editor)));

        expect(await find.find("needle", OPTIONS)).toBe(5);

        find.highlight(0);
        expect(highlightedText()).toBe("needle one");
        find.highlight(2);
        expect(embedTarget.highlight).toHaveBeenLastCalledWith(1);
        expect(highlightedText()).toBeNull();
        expect(editor.plugins.get(FindReveal).position?.path).toEqual([ 1, 0 ]);
        find.highlight(3);
        expect(highlightedText()).toBe("needle caption");
        find.highlight(4);
        expect(highlightedText()).toBe("needle two");
        expect(embedTarget.highlight).toHaveBeenLastCalledWith(null);
    });

    it("starts at a match at the selection, or at the first match below a line", async () => {
        const target = new TextEditorFindTarget(asTextEditor(editor));
        await target.find("needle", OPTIONS);
        expect(target.getSelectedMatch()).toBeNull();
        expect(target.getFirstMatchBelow(-Infinity)).toBe(0);
        expect(target.getFirstMatchBelow(Infinity)).toBeNull();

        const lastParagraph = editor.model.document.getRoot()?.getChild(2);
        if (!lastParagraph?.is("element")) throw new Error("Expected a third paragraph.");
        editor.model.change((writer) => writer.setSelection(lastParagraph, "in"));
        expect(target.getSelectedMatch()).toBe(2);
    });

    it("replaces one match or all of them, and closes on a match", async () => {
        const target = new TextEditorFindTarget(asTextEditor(editor));
        await target.find("needle", OPTIONS);

        expect(target.canReplace(0)).toBe(true);
        expect(target.canReplace(3)).toBe(false);
        expect(await target.replace(0, "pin")).toBe(2);
        expect(editor.getData()).toContain("<p>pin one</p>");
        expect(await target.replaceAll("pin")).toBe(0);
        expect(editor.getData()).not.toContain("needle");

        await target.find("pin", OPTIONS);
        // happy-dom has no layout to scroll.
        const scroll = vi.spyOn(editor.editing.view, "scrollToTheSelection")
            .mockImplementation(() => {});
        expect(target.close(2)).toBe(true);
        expect(scroll).toHaveBeenCalledOnce();
        const selection = editor.model.document.selection.getFirstRange();
        expect(selection?.start.path).toEqual([ 2, 0 ]);
        expect(selection?.end.path).toEqual([ 2, 3 ]);
        expect(editor.plugins.get(FindAndReplaceEditing).state?.results.length).toBe(0);
        expect(target.close(null)).toBe(false);
    });

    it("finds nothing once its editor is destroyed", async () => {
        const target = new TextEditorFindTarget(asTextEditor(editor));
        await editor.destroy();

        expect(await target.find("needle", OPTIONS)).toBe(0);
        expect(target.getEmbeds()).toEqual([]);
        expect(() => target.highlight(0)).not.toThrow();
        expect(() => target.revealEmbed(null)).not.toThrow();
        expect(target.close(null)).toBe(false);
    });
});

describe("FindInText", () => {
    it("drives the find bar, and marks it stale as embeds change", async () => {
        const parent = {
            noteContext: { getTextEditor: async () => editor },
            invalidateResults: vi.fn()
        };
        const handler = new FindInText(parent as unknown as FindWidget);
        registerEmbedTarget(1, false);

        expect(await handler.performFind("needle", false, false))
            .toEqual({ totalFound: 4, currentFound: 1 });
        await handler.findNext(1, 0, 1);
        expect(handler.canReplace()).toBe(false);
        await handler.findNext(1, 1, 3);
        expect(handler.canReplace()).toBe(true);
        expect(await handler.replace("pin")).toEqual({ totalFound: 3, currentFound: 1 });
        expect(editor.getData()).toContain("<p>pin two</p>");
        expect(await handler.replaceAll("pin")).toEqual({ totalFound: 1, currentFound: 1 });

        registerEmbedTarget(0);
        expect(parent.invalidateResults).toHaveBeenCalledOnce();
        await handler.findBoxClosed(1, 1);
        registerEmbedTarget(0);
        expect(parent.invalidateResults).toHaveBeenCalledOnce();
    });
});

/** A `contentEmbed` with a caption, as the editor saves an embed. */
function EmbedSchema(target: Editor) {
    target.model.schema.register("contentEmbed", { inheritAllFrom: "$blockObject" });
    target.model.schema.register("caption", {
        allowIn: "contentEmbed", allowContentOf: "$block", isLimit: true
    });
    target.conversion.elementToElement({
        model: "contentEmbed", view: { name: "figure", classes: "include-note" }
    });
    target.conversion.elementToElement({ model: "caption", view: "figcaption" });
}

/** Lets a fake target with `count` matches search the embed of the editor. */
function registerEmbedTarget(count: number, isEditable = true) {
    const embed = editor.editing.view.getDomRoot()?.querySelector<HTMLElement>(".include-note");
    if (!embed) throw new Error("The editor shows no embed.");
    const target = {
        find: vi.fn(async () => count),
        highlight: vi.fn((_index: number | null) => {}),
        getFirstMatchBelow: () => null,
        canReplace: () => isEditable,
        replace: async () => count,
        replaceAll: async () => count,
        close: () => false
    } satisfies FindTarget;
    cleanups.push(registerEmbedFindTarget(embed, target));
    return target;
}

/** The text of the block that holds the highlighted match, or `null` without one. */
function highlightedText() {
    const state = editor.plugins.get(FindAndReplaceEditing).state;
    const block = state?.highlightedResult?.marker?.getStart().parent;
    if (!block?.is("element")) return null;
    return [ ...block.getChildren() ]
        .map((child) => (child.is("$text") ? child.data : "")).join("");
}

function asTextEditor(textEditor: ClassicEditor) {
    return textEditor as unknown as CKTextEditor;
}
