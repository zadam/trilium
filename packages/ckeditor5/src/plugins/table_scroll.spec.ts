import "../theme/table_scroll.css";

import {
    _setModelData as setModelData,
    BlockQuote,
    Essentials,
    List,
    Paragraph,
    Table,
    TableCaption,
    TableColumnResize
} from "ckeditor5";
import type { ClassicEditor, ModelElement } from "ckeditor5";
import editorStylesheetUrl from "ckeditor5/ckeditor5.css?url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { createTestEditor } from "../../test/editor-kit.js";
import { modelTable } from "../../test/table-kit.js";
import TriliumTableScroll, { REFERENCE_WIDTH_PROPERTY } from "./table_scroll.js";

const PLUGINS = [Essentials, Paragraph, BlockQuote, Table, TableColumnResize, TriliumTableScroll];
const LONG_WORD = "x".repeat(400);

describe("TriliumTableScroll", () => {
    describe("without a reference width", () => {
        let editor: ClassicEditor;

        beforeEach(async () => {
            editor = await createTestEditor(PLUGINS);
            setEditableWidth(editor, 400);
        });

        it("keeps the upstream plugin name and column resizing", () => {
            expect(editor.plugins.get("TableScrollEditing")).toBeInstanceOf(TriliumTableScroll);
            expect(editor.plugins.get("TableColumnResize").isEnabled).toBe(true);
        });

        it("scrolls a table wider than the editable and sizes it by its percentage", () => {
            setModelData(editor.model, modelTable([["a", "b"]], 'tableWidth="150%"'));
            expectScrolling(editor, "150%");

            setModelData(editor.model, modelTable([["a", "b"]], 'tableWidth="50%"'));
            expectFitting(editor, "50%");
        });

        it("has no reference width for any table", () => {
            setModelData(editor.model, modelTable([["a", "b"]]));
            expect(tableScroll(editor).getReferenceWidth(firstTable(editor))).toBeNull();
        });
    });

    describe("with a reference width", () => {
        let editor: ClassicEditor;

        beforeEach(async () => {
            setReferenceWidth("1200px");
            editor = await createTestEditor(PLUGINS);
            setEditableWidth(editor, 400);
        });

        it("sizes a table with no width at the reference width", () => {
            setModelData(editor.model, modelTable([["a", "b"]]));
            expectScrolling(editor, "1200px");
            expect(tableScroll(editor).getReferenceWidth(firstTable(editor))).toBe(1200);
        });

        it("sizes a percentage width as a share of the reference width", () => {
            setModelData(editor.model, modelTable([["a", "b"]], 'tableWidth="50%"'));
            expectScrolling(editor, "600px");
        });

        it("keeps a width in other units", () => {
            setModelData(editor.model, modelTable([["a", "b"]], 'tableWidth="300px"'));
            expectFitting(editor, "300px");
        });

        it("fits a table into an editable wider than the reference width", () => {
            setEditableWidth(editor, 1500);
            setModelData(editor.model, modelTable([["a", "b"]]));
            expectFitting(editor, "1200px");
        });

        it("converts the widths of a column resize", () => {
            setModelData(editor.model, modelTable([["a", "b"]], 'tableWidth="50%"'));
            const table = firstTable(editor);

            tableScroll(editor)._updateTableScrollOverflowState(table, "75%");
            expectScrolling(editor, "900px");

            tableScroll(editor)._updateTableScrollOverflowState(table, null);
            expectScrolling(editor, "1200px");
        });

        it("sizes a table in a list", async () => {
            const listEditor = await createTestEditor([...PLUGINS, List]);
            setEditableWidth(listEditor, 400);
            setModelData(listEditor.model, '<table listIndent="0" listItemId="a00" '
                + 'listType="bulleted"><tableRow><tableCell><paragraph>a</paragraph></tableCell>'
                + "</tableRow></table>");
            const figure = listEditor.editing.view.getDomRoot()?.querySelector("li > figure.table");
            expect(figure).toBeInstanceOf(HTMLElement);
            expect(figure?.classList.contains("ck-table-overflowing")).toBe(true);
            expect(figure?.querySelector("table")?.style.width).toBe("1200px");
        });

        it("leaves a table that cannot scroll alone", () => {
            setModelData(editor.model, `<blockQuote>${modelTable([["a", "b"]])}</blockQuote>`);
            const figure = editor.editing.view.getDomRoot()?.querySelector("figure.table");
            expect(figure).toBeInstanceOf(HTMLElement);
            expect(figure?.classList.contains("ck-table-overflowing")).toBe(false);
            expect((figure as HTMLElement | null)?.style.width).toBe("");
        });

        it("has no reference width while the editable is detached", () => {
            setModelData(editor.model, modelTable([["a", "b"]]));
            vi.spyOn(editor.editing.view, "getDomRoot").mockReturnValueOnce(undefined);
            expect(tableScroll(editor).getReferenceWidth(firstTable(editor))).toBeNull();
        });

        it("turns column resizing off", () => {
            expect(editor.plugins.get("TableColumnResize").isEnabled).toBe(false);
        });

        it("works without column resizing", async () => {
            const plain = await createTestEditor([
                Essentials, Paragraph, Table, TriliumTableScroll
            ]);
            setEditableWidth(plain, 400);
            setModelData(plain.model, modelTable([["a", "b"]]));
            expect(plain.plugins.has("TableColumnResize")).toBe(false);
            expectScrolling(plain, "1200px");
        });
    });
});

describe("a table with content wider than the editable", () => {
    let editor: ClassicEditor;

    beforeEach(async () => {
        editor = await createTestEditor(PLUGINS);
        setEditableWidth(editor, 400);
    });

    it("scrolls, at the width of its content, until the content fits", () => {
        setModelData(editor.model, modelTable([["a", LONG_WORD]]));
        expectContentScrolling(editor);

        replaceLastCellText(editor, "b");
        const figure = domFigure(editor);
        expect(figure.classList.contains("ck-table-overflowing")).toBe(false);
        expect(figure.style.width).toBe("");
    });

    it("gets its saved width back once the content fits", () => {
        setModelData(editor.model, modelTable([["a", LONG_WORD]], 'tableWidth="50%"'));
        expectContentScrolling(editor);

        replaceLastCellText(editor, "b");
        expectFitting(editor, "50%");
    });

    it("keeps scrolling through an update of the upstream state", () => {
        setModelData(editor.model, modelTable([["a", LONG_WORD]]));
        const table = firstTable(editor);

        tableScroll(editor)._updateTableScrollOverflowState(table);
        expectContentScrolling(editor);

        tableScroll(editor)._updateTableScrollOverflowState(table, "140%");
        expectScrolling(editor, "140%");
    });

    it("checks again when an image in the editable loads", () => {
        setModelData(editor.model, modelTable([["a", "b"]]));
        const figure = domFigure(editor);
        expect(figure.classList.contains("ck-table-overflowing")).toBe(false);

        figure.querySelector("table")?.style.setProperty("min-width", "2000px");
        figure.querySelector("td")?.dispatchEvent(new Event("load"));
        expect(figure.classList.contains("ck-table-overflowing")).toBe(true);
    });

    it("leaves a table that cannot scroll alone", async () => {
        const fixed = await createTestEditor(PLUGINS, {
            table: { tableScroll: { tableTypes: [] } }
        });
        setEditableWidth(fixed, 400);
        setModelData(fixed.model, `<paragraph>a</paragraph>${modelTable([["a", LONG_WORD]])}`);
        expect(domFigure(fixed).classList.contains("ck-table-overflowing")).toBe(false);
    });

    it("gets the reference width back once the content fits", () => {
        setReferenceWidth("1200px");
        setEditableWidth(editor, 1500);
        setModelData(editor.model, modelTable([["a", LONG_WORD]]));
        expectContentScrolling(editor);

        replaceLastCellText(editor, "b");
        expectFitting(editor, "1200px");
    });
});

describe("the controls of a scrolling table", () => {
    const link = document.createElement("link");

    beforeAll(() => new Promise<void>((resolve, reject) => {
        link.rel = "stylesheet";
        link.href = editorStylesheetUrl;
        link.onload = () => resolve();
        link.onerror = () => reject(new Error("the editor stylesheet did not load"));
        document.head.appendChild(link);
    }));

    afterAll(() => {
        link.remove();
    });

    it("keeps the caption, the handle and the buttons whole and in view", async () => {
        const editor = await createTestEditor([...PLUGINS, TableCaption]);
        setEditableWidth(editor, 400);
        setModelData(editor.model, '<table tableWidth="150%"><tableRow><tableCell>'
            + "<paragraph>a</paragraph></tableCell></tableRow><caption>Caption</caption></table>");
        const figure = domFigure(editor);
        expect(figure.classList.contains("ck-table-overflowing")).toBe(true);
        const controls = [
            "figcaption",
            ".ck-widget__selection-handle",
            ".ck-widget__type-around__button_before",
            ".ck-widget__type-around__button_after"
        ].map((selector) => figure.querySelector(selector));
        for (const control of controls) {
            expect(control).toBeInstanceOf(HTMLElement);
        }

        const lefts = controls.map((control) => expectInside(figure, control));
        figure.scrollLeft = 100;
        expect(figure.scrollLeft).toBe(100);
        const scrolledLefts = controls.map((control) => expectInside(figure, control));
        for (const [index, left] of lefts.entries()) {
            expect(scrolledLefts[index]).toBeCloseTo(left, 0);
        }

        const [caption, , before] = controls;
        const table = figure.querySelector("table");
        expect(caption?.getBoundingClientRect().top)
            .toBeCloseTo(figure.getBoundingClientRect().top + figure.clientTop, 0);
        expect(table?.getBoundingClientRect().top)
            .toBeCloseTo(caption?.getBoundingClientRect().bottom ?? 0, 0);
        expect(before && getComputedStyle(before).borderBottomLeftRadius)
            .toBe(before && getComputedStyle(before).borderTopLeftRadius);
    });
});

/** Expects `control` within the visible part of `figure` and returns its left edge. */
function expectInside(figure: HTMLElement, control: Element | null) {
    const bounds = figure.getBoundingClientRect();
    const top = bounds.top + figure.clientTop;
    const left = bounds.left + figure.clientLeft;
    const rect = control?.getBoundingClientRect();
    expect(rect?.top).toBeGreaterThanOrEqual(top - 0.5);
    expect(rect?.bottom).toBeLessThanOrEqual(top + figure.clientHeight + 0.5);
    expect(rect?.left).toBeGreaterThanOrEqual(left - 0.5);
    expect(rect?.right).toBeLessThanOrEqual(left + figure.clientWidth + 0.5);
    return rect?.left ?? NaN;
}

function setReferenceWidth(width: string) {
    document.body.style.setProperty(REFERENCE_WIDTH_PROPERTY, width);
    onTestFinished(() => {
        document.body.style.removeProperty(REFERENCE_WIDTH_PROPERTY);
    });
}

function setEditableWidth(editor: ClassicEditor, width: number) {
    editor.ui.element?.style.setProperty("width", `${width}px`);
}

function tableScroll(editor: ClassicEditor) {
    return editor.plugins.get(TriliumTableScroll);
}

function firstTable(editor: ClassicEditor): ModelElement {
    const table = editor.model.document.getRoot()?.getChild(0);
    if (!table?.is("element", "table")) {
        throw new Error("The first root child is not a table.");
    }
    return table;
}

function domFigure(editor: ClassicEditor) {
    const figure = editor.editing.view.getDomRoot()?.querySelector(":scope > figure.table");
    if (!(figure instanceof HTMLElement)) {
        throw new Error("The editable has no table.");
    }
    return figure;
}

/** Expects the table to scroll inside its figure, `width` wide. */
function expectScrolling(editor: ClassicEditor, width: string) {
    const figure = domFigure(editor);
    expect(figure.classList.contains("ck-table-overflowing")).toBe(true);
    expect(figure.style.width).toBe("");
    expect(figure.querySelector("table")?.style.width).toBe(width);
}

/** Expects the table to scroll inside its figure at the width of its content. */
function expectContentScrolling(editor: ClassicEditor) {
    const figure = domFigure(editor);
    const table = figure.querySelector("table");
    expect(figure.classList.contains("ck-table-overflowing")).toBe(true);
    expect(figure.style.width).toBe("");
    expect(table?.style.width).toBe("");
    expect(table?.getBoundingClientRect().width).toBeGreaterThan(figure.clientWidth);
}

/** Replaces the text of the last cell of the first table. */
function replaceLastCellText(editor: ClassicEditor, text: string) {
    const cells = [...editor.model.createRangeIn(firstTable(editor)).getItems()]
        .filter((item) => item.is("element", "tableCell"));
    const paragraph = cells.at(-1)?.getChild(0);
    if (!paragraph?.is("element", "paragraph")) {
        throw new Error("The last cell has no paragraph.");
    }
    editor.model.change((writer) => {
        writer.remove(writer.createRangeIn(paragraph));
        writer.insertText(text, paragraph, 0);
    });
}

/** Expects the table to fit, its figure `width` wide. */
function expectFitting(editor: ClassicEditor, width: string) {
    const figure = domFigure(editor);
    expect(figure.classList.contains("ck-table-overflowing")).toBe(false);
    expect(figure.style.width).toBe(width);
    expect(figure.querySelector("table")?.style.width).toBe("");
}
