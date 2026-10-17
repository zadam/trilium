import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import Component from "../../../components/component";
import type { SaveState } from "../../../components/note_context";
import FAttachment from "../../../entities/fattachment";
import FBlob from "../../../entities/fblob";
import type FNote from "../../../entities/fnote";
import contextMenu from "../../../menus/context_menu";
import type { ContentEditor } from "../../../services/content_renderer";
import froca from "../../../services/froca";
import LoadResults from "../../../services/load_results";
import options from "../../../services/options";
import { buildNote } from "../../../test/easy-froca";
import { ParentComponent } from "../../react/react_utils";
import { CodeMirrorFindTarget } from "../../find_in_code";
import { getContentEmbedTools, getEmbedFindTarget } from "../text/content_embed_tools";
import CodeEmbed from "./CodeEmbed";

const renderCodePreview = vi.hoisted(() => vi.fn(async (content: string, _mime: string) => {
    const pre = document.createElement("pre");
    pre.textContent = content;
    return pre;
}));
vi.mock("../../../services/content_renderer", () => ({ renderCodePreview }));
vi.mock("../../../services/i18n", () => ({
    t: (key: string, values?: Record<string, unknown>) =>
        values ? `${key} ${Object.values(values).join(" ")}` : key
}));

// `CodeEditor` reads the theme as a string.
options.set("codeNoteTheme", "");

const parent = new Component();
const figures: HTMLElement[] = [];

afterEach(() => {
    for (const figure of figures) {
        const box = figure.querySelector(".include-note-content");
        if (box) act(() => render(null, box));
        figure.remove();
    }
    figures.length = 0;
    vi.restoreAllMocks();
});

describe("CodeEmbed", () => {
    it("shows the preview, and offers the Editable toggle only where it can edit", async () => {
        const note = buildCodeNote("print(1)");
        const preview = buildPreview("print(1)");
        const { figure } = await mount(note, buildEditor(), { preview });
        expect(figure.querySelector(".editable-embed-preview")?.firstChild).toBe(preview);
        expect(getContentEmbedTools(figure)?.hasEditableFlag).toBe(true);

        const { figure: locked } = await mount(note, buildEditor({ canEdit: () => false }));
        expect(getContentEmbedTools(locked)).toBeNull();

        const readOnly = buildNote({
            title: "Fixed", type: "code", mime: "text/x-python", content: "", "#readOnly": ""
        });
        const { figure: fixed } = await mount(readOnly, buildEditor());
        expect(getContentEmbedTools(fixed)).toBeNull();
    });

    it("edits with CodeMirror while the toggle is on, and saves only the changes", async () => {
        const editor = buildEditor();
        const { figure } = await mount(buildCodeNote("print(1)"), editor, { isEditable: true });

        const view = await findView(figure);
        expect(view.state.doc.toString()).toBe("print(1)");
        expect(figure.querySelector(".editable-embed-preview")).toBeNull();
        expect(editor.scheduleSave).not.toHaveBeenCalled();

        act(() => view.dispatch({ changes: { from: 0, insert: "# " } }));
        expect(editor.scheduleSave).toHaveBeenCalledOnce();
        const getContent = vi.mocked(editor.scheduleSave).mock.calls[0][0];
        expect(getContent()).toBe("# print(1)");
    });

    it("lets the find search the editor while the toggle is on", async () => {
        const { figure } = await mount(buildCodeNote("print(1)\nprint(2)"), buildEditor(), {
            isEditable: true
        });
        const view = await findView(figure);
        const target = getEmbedFindTarget(figure);
        if (!(target instanceof CodeMirrorFindTarget)) throw new Error("Expected a code target.");
        const onContentChange = vi.fn();
        const stopWatching = target.watchContent(onContentChange);

        expect(await target.find("print", { matchCase: false, wholeWord: false })).toBe(2);
        expect(figure.querySelectorAll(".cm-activeMatch")).toHaveLength(0);
        act(() => target.highlight(1));
        expect(figure.querySelectorAll(".cm-activeMatch")).toHaveLength(1);
        act(() => target.highlight(null));
        expect(figure.querySelectorAll(".cm-activeMatch")).toHaveLength(0);
        expect(target.getFirstMatchBelow(-Infinity)).toBe(0);
        expect(target.getFirstMatchBelow(Infinity)).toBeNull();
        expect(onContentChange).not.toHaveBeenCalled();

        expect(await target.replace(1, "log")).toBe(1);
        expect(view.state.doc.toString()).toBe("print(1)\nlog(2)");
        expect(onContentChange).toHaveBeenCalledOnce();
        expect(target.close(0)).toBe(true);
        expect([ view.state.selection.main.from, view.state.selection.main.to ]).toEqual([ 0, 5 ]);
        stopWatching();
        act(() => view.dispatch({ changes: { from: 0, insert: "#" } }));
        expect(onContentChange).toHaveBeenCalledOnce();

        await act(async () => {
            delete figure.dataset.editable;
            await Promise.resolve();
        });
        expect(getEmbedFindTarget(figure)).toBeNull();
        expect(await target.find("print", { matchCase: false, wholeWord: false })).toBe(0);
    });

    it("releases the editor and previews the edited content once the toggle goes off", async () => {
        const editor = buildEditor();
        const { figure } = await mount(buildCodeNote("a"), editor, { isEditable: true });
        const view = await findView(figure);
        act(() => view.dispatch({ changes: { from: 1, insert: "b" } }));

        await act(async () => {
            delete figure.dataset.editable;
            await Promise.resolve();
        });

        expect(editor.release).toHaveBeenCalledOnce();
        await vi.waitFor(() => {
            expect(figure.querySelector(".editable-embed-preview")?.textContent).toBe("ab");
        });
        expect(figure.querySelector(".cm-editor")).toBeNull();
    });

    it("offers the language and tab width menus of a note on the toolbar of its embed", async () => {
        options.set("codeNoteTabWidth", "4");
        options.set("codeNoteIndentWithTabs", "false");
        options.set("codeNotesMimeTypes", JSON.stringify([ "text/x-python" ]));
        const show = vi.spyOn(contextMenu, "show").mockResolvedValue(undefined);
        let unsavedContent: string | undefined;
        const editor = buildEditor({
            getUnsavedContent: () => unsavedContent,
            scheduleSave: vi.fn((getContent: () => string) => {
                unsavedContent = getContent();
            })
        });
        const { figure } = await mount(buildCodeNote("if a:\n    b"), editor);
        const tools = getContentEmbedTools(figure);
        expect(tools?.hasEditableFlag).toBe(true);
        expect(tools?.getTools().map(({ id, label, text, opensMenu }) => ({
            id, label, text, opensMenu
        }))).toEqual([
            {
                id: "codeLanguage", label: "status_bar.code_note_switcher", text: "Python",
                opensMenu: true
            },
            {
                id: "tabWidth", label: "status_bar.tab_width_title",
                text: "status_bar.tab_width_spaces_short 4", opensMenu: true
            }
        ]);

        /** Runs the item `title` of the "Re-indent" part of the tab width menu. */
        const reindentTo = async (title: string) => {
            tools?.openMenu?.("tabWidth", document.createElement("button"));
            const items = show.mock.lastCall?.[0].items.slice(-7) ?? [];
            const item = items.find((candidate) => "title" in candidate && candidate.title === title);
            if (!item || "kind" in item) throw new Error(`No item titled ${title}.`);
            await act(async () => item.handler?.(item, new MouseEvent("click")));
        };
        const getLastSave = () => vi.mocked(editor.scheduleSave).mock.lastCall?.[0]();

        // The preview, which is saved.
        await reindentTo("status_bar.tab_width_style_tabs");
        expect(getLastSave()).toBe("if a:\n\tb");
        await vi.waitFor(() => {
            expect(figure.querySelector(".editable-embed-preview")?.textContent).toBe("if a:\n\tb");
        });

        // The editor while it is open, then the preview again once it closes.
        await act(async () => {
            figure.dataset.editable = "true";
            await Promise.resolve();
        });
        const view = await findView(figure);
        act(() => view.dispatch({ changes: { from: 0, insert: "# " } }));
        await reindentTo("status_bar.tab_width_spaces 8");
        expect(view.state.doc.toString()).toBe("# if a:\n        b");
        await act(async () => {
            delete figure.dataset.editable;
            await Promise.resolve();
        });
        await reindentTo("status_bar.tab_width_spaces 2");
        expect(getLastSave()).toBe("# if a:\n    b");
        await vi.waitFor(() => {
            expect(figure.querySelector(".editable-embed-preview")?.textContent)
                .toBe("# if a:\n    b");
        });
    });

    it("keeps the language and indentation of a file in its embed, set from its toolbar", async () => {
        options.set("codeNoteTabWidth", "4");
        options.set("codeNoteIndentWithTabs", "false");
        options.set("codeNotesMimeTypes", JSON.stringify([ "text/x-python", "text/x-sh" ]));
        const show = vi.spyOn(contextMenu, "show").mockResolvedValue(undefined);
        const editor = buildEditor();
        const { textEditor, editable } = buildTextEditor();
        const { figure } = await mount(buildAttachment("script.py"), editor, {
            content: "if a:\n  b",
            mime: "text/x-python",
            codeLanguage: "text/x-sh",
            embedAttributes: { "data-code-language": "text/x-sh", "data-code-tab-width": "2" },
            container: editable
        });
        const tools = getContentEmbedTools(figure);
        expect(tools?.hasEditableFlag).toBe(true);
        expect(tools?.getTools().map((tool) => tool.text))
            .toEqual([ "Shell (bash)", "status_bar.tab_width_spaces_short 2" ]);
        expect(renderCodePreview).not.toHaveBeenCalled();

        /** Runs the item `title` of the menu `id`, of the "Re-indent" part when `isReindent`. */
        const select = async (id: string, title: string, isReindent = false) => {
            tools?.openMenu?.(id, document.createElement("button"));
            const items = show.mock.lastCall?.[0].items ?? [];
            const item = (isReindent ? items.slice(-7) : items)
                .find((candidate) => "title" in candidate && candidate.title === title);
            if (!item || "kind" in item) throw new Error(`No item titled ${title}.`);
            await act(async () => item.handler?.(item, new MouseEvent("click")));
        };

        // The language of the file's name is its default, which the embed then leaves out.
        await select("codeLanguage", "Python");
        expect(textEditor.execute)
            .toHaveBeenLastCalledWith("setContentEmbedCodeView", { language: null });
        await vi.waitFor(() => {
            expect(renderCodePreview).toHaveBeenLastCalledWith("if a:\n  b", "text/x-python");
        });
        await select("codeLanguage", "Plain text");
        expect(figure.getAttribute("data-code-language")).toBe("text/plain");
        await vi.waitFor(() => {
            expect(renderCodePreview).toHaveBeenLastCalledWith("if a:\n  b", "text/plain");
        });

        // The indentation, which a re-indent sets with the content, as one change.
        await select("tabWidth", "status_bar.tab_width_style_tabs");
        await select("tabWidth", "status_bar.tab_width_spaces 4", true);
        expect(vi.mocked(editor.scheduleSave).mock.lastCall?.[0]()).toBe("if a:\n    b");
        expect(textEditor.execute.mock.calls.slice(-2).map(([ , codeView ]) => codeView))
            .toEqual([
                { tabWidth: undefined, indentWithTabs: true },
                { tabWidth: 4, indentWithTabs: false }
            ]);
        expect([ "data-code-tab-width", "data-code-indent-with-tabs" ]
            .map((name) => figure.getAttribute(name))).toEqual([ "4", "false" ]);

        // CodeMirror follows the indentation of the embed.
        figure.setAttribute("data-code-tab-width", "2");
        figure.setAttribute("data-code-indent-with-tabs", "true");
        await act(async () => {
            figure.dataset.editable = "true";
            await Promise.resolve();
        });
        const view = await findView(figure);
        const { indentUnit } = await import("@codemirror/language");
        expect([ view.state.tabSize, view.state.facet(indentUnit) ]).toEqual([ 2, "\t" ]);

        // Nothing changes without the text editor of the embed.
        textEditor.execute.mockClear();
        textEditor.selectEmbedAt.mockReturnValue(false);
        await select("tabWidth", "status_bar.tab_width_spaces 8");
        expect(textEditor.execute).not.toHaveBeenCalled();
    });

    it("highlights an attachment with the MIME type it is given", async () => {
        const attachment = new FAttachment(froca, {
            attachmentId: "script1",
            ownerId: "owner",
            role: "file",
            mime: "text/plain",
            title: "script.py",
            dateModified: "",
            utcDateModified: "",
            utcDateScheduledForErasureSince: "",
            contentLength: 0
        } as never);
        const { figure } = await mount(attachment, buildEditor(), {
            content: "a",
            mime: "text/x-python",
            isEditable: true
        });
        const view = await findView(figure);
        act(() => view.dispatch({ changes: { from: 1, insert: "b" } }));

        await act(async () => {
            delete figure.dataset.editable;
            await Promise.resolve();
        });
        await vi.waitFor(() => {
            expect(renderCodePreview).toHaveBeenLastCalledWith("ab", "text/x-python");
        });
    });

    it("follows each save of its note or attachment, its own included, while it has no changes", async () => {
        const note = buildCodeNote("one");
        const editor = buildEditor();
        const { figure } = await mount(note, editor, { content: "one", isEditable: true });
        const view = await findView(figure);

        // A save of this embed, or of another embed of the same note.
        note.getBlob = async () => buildBlob("two");
        const noteSaved = new LoadResults([]);
        noteSaved.addNoteContent(note.noteId, "any-component");
        await act(async () => {
            await parent.handleEvent("entitiesReloaded", { loadResults: noteSaved });
        });
        await vi.waitFor(() => expect(view.state.doc.toString()).toBe("two"));

        const attachment = buildAttachment("script.py");
        const { figure: attachmentFigure } = await mount(attachment, buildEditor(), {
            content: "a",
            isEditable: true
        });
        const attachmentView = await findView(attachmentFigure);
        attachment.getBlob = async () => buildBlob("b");
        const attachmentSaved = new LoadResults([]);
        attachmentSaved.addAttachmentRow({ attachmentId: attachment.attachmentId } as never, "any");
        await act(async () => {
            await parent.handleEvent("entitiesReloaded", { loadResults: attachmentSaved });
        });
        await vi.waitFor(() => expect(attachmentView.state.doc.toString()).toBe("b"));
    });

    it("keeps the latest attachment content when an older fetch resolves last", async () => {
        const attachment = buildAttachment("script.py");
        const { figure } = await mount(attachment, buildEditor(), {
            content: "a",
            isEditable: true
        });
        const view = await findView(figure);
        const resolvers: ((blob: FBlob) => void)[] = [];
        attachment.getBlob = () => new Promise((resolve) => resolvers.push(resolve));
        const saved = new LoadResults([]);
        saved.addAttachmentRow({ attachmentId: attachment.attachmentId } as never, "any");
        await act(async () => {
            await parent.handleEvent("entitiesReloaded", { loadResults: saved });
            await parent.handleEvent("entitiesReloaded", { loadResults: saved });
        });
        expect(resolvers).toHaveLength(2);

        await act(async () => {
            resolvers[1](buildBlob("new"));
        });
        await vi.waitFor(() => expect(view.state.doc.toString()).toBe("new"));
        await act(async () => {
            resolvers[0](buildBlob("old"));
            await new Promise((resolve) => setTimeout(resolve, 50));
        });
        expect(view.state.doc.toString()).toBe("new");
    });

    it("shows how the saving goes in the title row of its embed while it edits", async () => {
        const listeners = new Set<() => void>();
        let state: SaveState = "unsaved";
        const editor = buildEditor({
            getSaveState: () => state,
            subscribeSaveState: (listener) => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            }
        });
        const { figure } = await mount(buildCodeNote("x"), editor, {
            content: "x",
            isEditable: true
        });
        const findBadge = (name: string) =>
            figure.querySelector(`.include-note-badges > .save-status-badge.${name}`);
        await vi.waitFor(() => expect(findBadge("unsaved")).not.toBeNull());

        act(() => {
            state = "error";
            for (const listener of listeners) listener();
        });
        await vi.waitFor(() => expect(findBadge("error")).not.toBeNull());

        await act(async () => {
            delete figure.dataset.editable;
            await Promise.resolve();
        });
        expect(figure.querySelector(".save-status-badge")).toBeNull();
    });

    it("loads the note as saved elsewhere, unless it has unsaved changes", async () => {
        const { figure } = await mount(buildCodeNote("saved"), buildEditor(), {
            content: "stale",
            isEditable: true
        });
        const view = await findView(figure);
        await vi.waitFor(() => expect(view.state.doc.toString()).toBe("saved"));

        const { figure: changed } = await mount(
            buildCodeNote("saved"),
            buildEditor({ getUnsavedContent: () => "unsaved" }),
            { content: "unsaved", isEditable: true }
        );
        const changedView = await findView(changed);
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
        });
        expect(changedView.state.doc.toString()).toBe("unsaved");
    });
});

interface MountOptions {
    content?: string;
    mime?: string;
    codeLanguage?: string;
    preview?: HTMLElement;
    isEditable?: boolean;
    /** Attributes of the embed, such as `data-code-language`. */
    embedAttributes?: Record<string, string>;
    /** The element the embed goes in, such as the editable root of a text editor. */
    container?: HTMLElement;
}

/** Renders `CodeEmbed` in the markup of an embed, as the host does. */
async function mount(
    entity: FNote | FAttachment,
    editor: ContentEditor,
    options: MountOptions = {}
) {
    const content = options.content ?? "";
    const figure = document.createElement("figure");
    figure.className = "include-note";
    if (options.isEditable) {
        figure.dataset.editable = "true";
    }
    for (const [ name, value ] of Object.entries(options.embedAttributes ?? {})) {
        figure.setAttribute(name, value);
    }
    const wrapper = document.createElement("div");
    wrapper.className = "include-note-wrapper";
    const titleRow = document.createElement("div");
    titleRow.className = "include-note-title-row";
    const badges = document.createElement("div");
    badges.className = "include-note-badges";
    titleRow.append(badges);
    const box = document.createElement("div");
    box.className = "include-note-content";
    wrapper.append(titleRow, box);
    figure.append(wrapper);
    (options.container ?? document.body).append(figure);
    figures.push(figure);

    await act(async () => {
        render(
            <ParentComponent.Provider value={parent}>
                <CodeEmbed
                    entity={entity}
                    editor={editor}
                    content={options.content ?? (await entity.getBlob())?.content ?? content}
                    mime={options.mime ?? entity.mime}
                    codeLanguage={options.codeLanguage}
                    preview={options.preview ?? buildPreview(content)}
                />
            </ParentComponent.Provider>,
            box
        );
    });
    return { figure };
}

function buildCodeNote(content: string) {
    return buildNote({ title: "Script", type: "code", mime: "text/x-python", content });
}

function buildEditor(overrides: Partial<ContentEditor> = {}): ContentEditor {
    return {
        canEdit: () => true,
        getUnsavedContent: () => undefined,
        scheduleSave: vi.fn(),
        release: vi.fn(),
        ...overrides
    };
}

/**
 * The editable root of a text editor, in the page, and the editor, whose code view command sets
 * the `data-code-*` attributes of the embed it selects, as the text editor renders them.
 */
function buildTextEditor() {
    let selected: Element | null = null;
    const textEditor = {
        selectEmbedAt: vi.fn((element: Element) => {
            selected = element.closest(".include-note");
            return true;
        }),
        plugins: { get: () => ({ selectEmbedAt: textEditor.selectEmbedAt }) },
        execute: vi.fn((_name: string, codeView: Record<string, unknown>) => {
            const attributes = {
                language: "data-code-language",
                tabWidth: "data-code-tab-width",
                indentWithTabs: "data-code-indent-with-tabs"
            };
            for (const [ setting, attribute ] of Object.entries(attributes)) {
                const value = codeView[setting];
                if (value === null) {
                    selected?.removeAttribute(attribute);
                } else if (value !== undefined) {
                    selected?.setAttribute(attribute, String(value));
                }
            }
        })
    };
    const editable = document.createElement("div");
    editable.className = "ck-editor__editable";
    Object.assign(editable, { ckeditorInstance: textEditor });
    document.body.append(editable);
    figures.push(editable);
    return { textEditor, editable };
}

function buildPreview(content: string) {
    const pre = document.createElement("pre");
    pre.textContent = content;
    return pre;
}

/** The CodeMirror view in `figure`, once the editor module has loaded. */
async function findView(figure: HTMLElement) {
    const { EditorView } = await import("@codemirror/view");
    let view: InstanceType<typeof EditorView> | null = null;
    await vi.waitFor(() => {
        const dom = figure.querySelector(".cm-editor");
        view = dom instanceof HTMLElement ? EditorView.findFromDOM(dom) : null;
        expect(view).not.toBeNull();
    }, { timeout: 5000 });
    if (!view) throw new Error("CodeMirror did not mount.");
    return view as InstanceType<typeof EditorView>;
}

function buildBlob(content: string) {
    return new FBlob({
        blobId: `blob-${content}`,
        content,
        contentLength: content.length,
        dateModified: "",
        utcDateModified: ""
    });
}

function buildAttachment(title: string) {
    return new FAttachment(froca, {
        attachmentId: `att-${title}`,
        ownerId: "owner",
        role: "file",
        mime: "text/plain",
        title,
        dateModified: "",
        utcDateModified: "",
        utcDateScheduledForErasureSince: "",
        contentLength: 0
    } as never);
}
