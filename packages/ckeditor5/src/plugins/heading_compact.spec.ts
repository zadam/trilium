import {
    _setModelData as setModelData,
    ClassicEditor,
    CodeBlock,
    DropdownView,
    Essentials,
    Heading,
    IconHeading2,
    IconHeading3,
    IconParagraph,
    Paragraph
} from "ckeditor5";
import editorStylesheetUrl from "ckeditor5/ckeditor5.css?url";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestEditor } from "../../test/editor-kit.js";
import HeadingCompactUI from "./heading_compact.js";

describe("HeadingCompactUI", () => {
    let editor: ClassicEditor;

    // The width of the dropdown button needs the editor's stylesheet.
    beforeAll(() => new Promise<void>((resolve, reject) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = editorStylesheetUrl;
        link.onload = () => resolve();
        link.onerror = () => reject(new Error("the editor stylesheet did not load"));
        document.head.appendChild(link);
    }));

    beforeEach(async () => {
        editor = await createTestEditor([Essentials, Paragraph, Heading, CodeBlock, HeadingCompactUI], {
            toolbar: ["heading", "headingCompact"],
            heading: {
                options: [
                    { model: "paragraph", title: "Paragraph", class: "ck-heading_paragraph" },
                    { model: "heading2", view: "h2", title: "Heading 2", class: "ck-heading_heading2" },
                    { model: "heading3", view: "h3", title: "Heading 3", class: "ck-heading_heading3" }
                ]
            }
        });
    });

    it("shows the current block as an icon instead of its name", () => {
        const { buttonView } = getDropdown(editor, 1);
        expect(buttonView.withText).toBe(false);

        setModelData(editor.model, "<paragraph>foo[]</paragraph>");
        expect(buttonView.icon).toBe(IconParagraph);

        setModelData(editor.model, "<heading2>foo[]</heading2>");
        expect(buttonView.icon).toBe(IconHeading2);
        expect(buttonView.ariaLabel).toBe("Heading 2, Heading");

        setModelData(editor.model, "<heading3>foo[]</heading3>");
        expect(buttonView.icon).toBe(IconHeading3);
        expect(buttonView.element?.querySelector(".ck-button__icon")).not.toBeNull();
    });

    it("falls back to the paragraph icon in a block that is neither", () => {
        setModelData(editor.model, "<codeBlock language=\"plaintext\">foo[]</codeBlock>");
        expect(getDropdown(editor, 1).buttonView.icon).toBe(IconParagraph);
    });

    it("keeps the list of the heading dropdown and switches the block", () => {
        setModelData(editor.model, "<paragraph>foo[]</paragraph>");
        const dropdown = getDropdown(editor, 1);
        dropdown.isOpen = true;

        const items = [...dropdown.element?.querySelectorAll(".ck-list__item .ck-button__label") ?? []];
        expect(items.map((item) => item.textContent)).toStrictEqual([ "Paragraph", "Heading 2", "Heading 3" ]);

        const heading2 = dropdown.element?.querySelectorAll<HTMLElement>(".ck-list__item .ck-button")[1];
        expect(heading2).toBeDefined();
        heading2?.click();
        expect(editor.getData()).toBe("<h2>foo</h2>");
    });

    it("is narrower than the heading dropdown", () => {
        setModelData(editor.model, "<paragraph>foo[]</paragraph>");
        const full = getDropdown(editor, 0).buttonView.element?.getBoundingClientRect().width ?? 0;
        const compact = getDropdown(editor, 1).buttonView.element?.getBoundingClientRect().width ?? 0;

        expect(full).toBeGreaterThan(100);
        expect(compact).toBeGreaterThan(0);
        expect(compact).toBeLessThan(full / 2);
    });
});

function getDropdown(editor: ClassicEditor, index: number) {
    const item = editor.ui.view.toolbar.items.get(index);
    if (!(item instanceof DropdownView)) {
        throw new Error(`toolbar item ${index} is not a dropdown`);
    }
    return item;
}
