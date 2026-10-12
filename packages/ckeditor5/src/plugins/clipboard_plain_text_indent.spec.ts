import { _setModelData as setModelData, Essentials, Heading, Indent, IndentBlock, Paragraph } from "ckeditor5";
import type { ClassicEditor, ViewDocumentFragment } from "ckeditor5";
import { describe, expect, it } from "vitest";

import { createTestEditor } from "../../test/editor-kit.js";
import ClipboardPlainTextIndent, { viewToIndentedPlainText } from "./clipboard_plain_text_indent.js";

describe("ClipboardPlainTextIndent", () => {
    async function createEditor(html: string, extraConfig = {}) {
        const editor = await createTestEditor(
            [Essentials, Paragraph, Heading, Indent, IndentBlock, ClipboardPlainTextIndent],
            extraConfig
        );
        editor.setData(html);
        editor.execute("selectAll");
        return editor;
    }

    function copy(editor: ClassicEditor) {
        const dataTransfer = recordingDataTransfer();
        editor.editing.view.document.fire("copy", { dataTransfer, preventDefault: () => {}, method: "copy" });
        return dataTransfer;
    }

    it("prefixes each indented block with one tab per indent level", async () => {
        const editor = await createEditor([
            "<p>Top</p>",
            `<p style="margin-left:40px">One</p>`,
            `<p style="margin-left:80px">Two</p>`,
            `<h2 style="margin-left:40px">Heading</h2>`,
            "<p>Back</p>"
        ].join(""));

        expect(copy(editor).getData("text/plain")).toBe("Top\n\n\tOne\n\n\t\tTwo\n\n\tHeading\n\nBack");
    });

    it("indents every line of a block that holds soft breaks, but not past a trailing one", async () => {
        const editor = await createEditor(`<p style="margin-left:40px">First<br>Second<br><strong>Third<br></strong></p><p>End</p>`);

        expect(copy(editor).getData("text/plain")).toBe("\tFirst\n\tSecond\n\tThird\n\n\nEnd");
    });

    it("writes nothing for a copy of an empty selection", async () => {
        const editor = await createEditor(`<p style="margin-left:40px">One</p>`);
        setModelData(editor.model, `<paragraph blockIndent="40px">[]One</paragraph>`);

        expect(copy(editor).store).not.toHaveProperty("text/plain");
    });

    it("leaves a copy inside one block unindented, as CKEditor copies only its text", async () => {
        const editor = await createEditor(`<p style="margin-left:40px">One</p>`);

        expect(copy(editor).getData("text/plain")).toBe("One");
    });

    it("leaves the HTML flavor untouched", async () => {
        const editor = await createEditor(`<p style="margin-left:40px">One</p><p>Two</p>`);

        expect(copy(editor).getData("text/html")).toBe(`<p style="margin-left:40px;">One</p><p>Two</p>`);
    });

    it("counts levels against the configured offset and gives a foreign unit one level", async () => {
        const editor = await createEditor(
            `<p style="margin-left:4em">Two</p><p style="margin-left:15px">Foreign</p>`,
            { indentBlock: { offset: 2, unit: "em" } }
        );

        expect(copy(editor).getData("text/plain")).toBe("\t\tTwo\n\n\tForeign");
    });

    it("reads the right margin of right-to-left content", async () => {
        const editor = await createEditor(`<p style="margin-right:40px">Shalom</p><p>End</p>`, { language: { content: "he" } });

        expect(copy(editor).getData("text/plain")).toBe("\tShalom\n\nEnd");
    });

    it("serializes a fragment without changing it", async () => {
        const editor = await createEditor(`<p>One</p><p style="margin-left:40px">Two<br>Three</p>`);
        const content = editor.data.toView(
            editor.model.getSelectedContent(editor.model.document.selection),
            { isClipboardPipeline: true }
        );
        const before = editor.data.processor.toData(content);

        expect(viewToIndentedPlainText(editor, content)).toBe("One\n\n\tTwo\n\tThree");
        expect(editor.data.processor.toData(content)).toBe(before);
    });

    it("does not indent a block whose margin is zero or not a length", async () => {
        const editor = await createEditor("");
        const content = editor.data.processor.toView(
            `<p style="margin-left:0px">Zero</p><p style="margin-left:auto">Auto</p>`
        ) as ViewDocumentFragment;

        expect(viewToIndentedPlainText(editor, content)).not.toContain("\t");
    });
});

function recordingDataTransfer() {
    const store: Record<string, string> = {};
    return {
        store,
        setData: (type: string, data: string) => { store[type] = data; },
        getData: (type: string) => store[type] ?? ""
    };
}
