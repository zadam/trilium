import "./collab_editor.css";
import "./stylesheets/ckeditor-theme.css";
import "./stylesheets/codemirror-placeholder.css";

import { GuestEditor, placeCursorInNewTopParagraph } from "@triliumnext/ckeditor5";
import CodeMirror from "@triliumnext/codemirror";
import type { CollabPerson } from "@triliumnext/commons";

import {
    codeCursorAdapter, createCursorSync, type CursorAdapter, type RemoteCursorMessage,
    textCursorAdapter
} from "./collab/cursor_sync.js";
import { GuestSaver, type GuestSaveState } from "./collab/guest_saver.js";
import { focusTitleIfNew, makeTitleEditable, type TitleHandoff } from "./collab/guest_title.js";
import { mergeCode, mergeTextEditor } from "./collab/live_merge.js";
import { setupNoteAppearance } from "./collab/note_appearance.js";
import { themeCodeEditor } from "./collab/page_theme.js";
import { type IndentStyle, reindentEditorText } from "./widgets/layout/reindentation.js";

/** What `collab.ejs` writes to `window.collab`. */
export interface CollabBootstrap {
    collabId: string;
    rootNoteId: string;
    noteId: string;
    title: string;
    type: string;
    mime: string;
    blobId: string | null;
    includeSubtree: boolean;
    capabilities: string[];
    csrfToken: string | null;
    /** Whether this note's content and type are the guest's to change. */
    editable?: boolean;
    /** The page's own person in the list of people. */
    selfId?: string | null;
    /** Who is on the collaboration's pages, from the last presence. */
    people?: CollabPerson[];
    /** A code note's indentation, which the status bar changes; null for other notes. */
    indentation?: IndentStyle | null;
    strings: Record<string, string>;
    /** The server's live messages, dispatched as `CustomEvent`s named by message type. */
    events?: EventTarget;
    /** Sends a message over the guest socket while it is open. */
    send?: (message: object) => void;
    /**
     * Set here: saves the open note and loads `next` into this editor, for the page to open that
     * note in place. Resolves `false` when this editor cannot take it.
     */
    switchNote?: (next: CollabBootstrap) => Promise<boolean>;
}

interface CollabUpdate {
    notes: {
        noteId: string;
        title: string;
        blobId: string | null;
        type?: string;
        mime?: string;
        isDeleted: boolean;
        componentId: string;
    }[];
}

interface GuestNote {
    blobId: string | null;
    content: string | null;
}

/** What the editor holds, and how to replace it with the server's version. */
export interface EditorHandle extends TitleHandoff {
    get(): string;
    set(content: string): void;
    /** Highlights a code note's content as `mime`. */
    setMime?(mime: string): void;
    /** Indents a code note as `indentation` says from now on. */
    setIndentation?(indentation: IndentStyle): void;
    /** Rewrites the content's indentation from one style to another, as an edit to save. */
    reindent?(from: IndentStyle, to: IndentStyle): void;
    /**
     * Puts the edits made since `base` into `theirs`, another person's version, in place: the
     * caret stays where it is and undo skips their edits. Returns false, changing nothing, when
     * both changed the same part.
     */
    merge?(base: string, theirs: string): boolean;
    /** Where the editor reads its own selection and draws the others', when it shows them. */
    cursors?: CursorAdapter;
}

const TOOLBAR_ITEMS = [
    "heading", "|",
    "bold", "italic", "underline", "strikethrough", "code", "|",
    "link", "bulletedList", "numberedList", "todoList", "|",
    "blockQuote", "codeBlock", "insertTable", "horizontalLine", "|",
    "alignment", "outdent", "indent", "|",
    "removeFormat", "|",
    "undo", "redo"
];

/** The types whose editor loads another note of its type in place, keeping its toolbar. */
const SWITCHES_IN_PLACE = new Set([ "text", "code", "mermaid" ]);

/**
 * Turns the rendered note on a collaboration page into an editor, saving through the guest API.
 * Loaded by the share theme's `collab` module once the guest holds the edit capability.
 */
export default async function mountGuestEditor(bootstrap: CollabBootstrap): Promise<void> {
    const content = document.getElementById("content");
    const csrfToken = bootstrap.csrfToken;

    if (!content || !csrfToken || !bootstrap.capabilities.includes("edit")) {
        return;
    }

    // A note's color and icon are the guest's to change on every page, editable or not.
    setupNoteAppearance(bootstrap, csrfToken);

    if (bootstrap.editable === false) {
        return;
    }

    const note = await fetchGuestNote(bootstrap.noteId);
    // A collection has no content to edit: its page shows its child notes.
    const hasContent = bootstrap.type !== "book";

    if (hasContent && note.content === null) {
        return;
    }

    const chrome = buildChrome(content, bootstrap.strings, hasContent);
    const saver = new GuestSaver({
        apiBase: "api/",
        noteId: bootstrap.noteId,
        blobId: note.blobId,
        content: note.content,
        csrfToken,
        componentId: `collab-${Math.random().toString(36).slice(2, 10)}`,
        onState: (state) => chrome.showState(state)
    });

    const editor = hasContent
        ? await mountContentEditor(bootstrap, chrome.host, note.content ?? "", saver)
        : null;

    if (editor?.cursors) {
        followCursors(bootstrap, editor.cursors);
    }

    saver.reconcile = (base, theirs) => editor?.merge?.(base, theirs) ?? false;

    // A removed guest's edits have nowhere to go.
    bootstrap.events?.addEventListener("collab-removed", () => saver.dispose());

    // The status bar's indentation menu.
    bootstrap.events?.addEventListener("collab-indentation", (event) =>
        editor?.setIndentation?.((event as CustomEvent<IndentStyle>).detail));
    bootstrap.events?.addEventListener("collab-reindent", (event) => {
        const { from, to } = (event as CustomEvent<{ from: IndentStyle; to: IndentStyle }>).detail;
        editor?.reindent?.(from, to);
    });

    chrome.onReload = () => {
        const conflict = saver.conflict;

        if (conflict && editor) {
            editor.set(conflict.content);
            saver.acceptServerVersion();
        }
    };
    chrome.onOverwrite = () => {
        if (editor) {
            void saver.overwrite(() => editor.get());
        }
    };

    makeTitleEditable(saver, editor ?? { focusStart: () => {} });

    followRemoteChanges(bootstrap, editor, saver);
    focusTitleIfNew(bootstrap.noteId);

    // Another note opened in place takes this editor and its toolbar. Setting the content clears
    // CKEditor's undo history, so undo never reaches back into the note before.
    bootstrap.switchNote = async (next) => {
        if (!editor || !SWITCHES_IN_PLACE.has(bootstrap.type) || next.editable === false
            || next.type !== bootstrap.type) {
            return false;
        }

        const nextNote = await fetchGuestNote(next.noteId);

        if (nextNote.content === null
            || !await saver.switchNote(next.noteId, nextNote.blobId, nextNote.content)) {
            return false;
        }

        editor.set(nextNote.content);
        editor.setMime?.(next.mime);

        if (next.indentation) {
            editor.setIndentation?.(next.indentation);
        }

        return true;
    };
    bootstrap.events?.addEventListener("collab-navigated", () => {
        chrome.notice(bootstrap.strings.editing_hint ?? "");
        bootstrap.send?.({ type: "collab-editing", noteId: bootstrap.noteId });
        focusTitleIfNew(bootstrap.noteId);
    });

    // The note options menu asks for a switch of type through the page's events.
    bootstrap.events?.addEventListener("collab-switch-type", (event) => {
        const { type, mime } = (event as CustomEvent<{ type: string; mime: string }>).detail;
        void saver.switchType(type, mime).then((switched) => {
            if (switched) {
                location.reload();
            }
        });
    });

    window.addEventListener("beforeunload", () => {
        bootstrap.send?.({ type: "collab-editing", noteId: null });
        void saver.flush();
    });
}

/** Shares the guest's selection with the others on the note, and draws theirs. */
function followCursors(bootstrap: CollabBootstrap, adapter: CursorAdapter) {
    const events = bootstrap.events;
    const sync = createCursorSync({
        noteId: bootstrap.noteId,
        selfId: bootstrap.selfId ?? "",
        adapter,
        send: (message) => bootstrap.send?.(message)
    });

    sync.setPeople(bootstrap.people ?? []);
    events?.addEventListener("collab-presence", (event) => {
        sync.setPeople((event as CustomEvent<{ people: CollabPerson[] }>).detail.people);
    });
    events?.addEventListener("collab-remote-cursor", (event) => {
        sync.receive((event as CustomEvent<RemoteCursorMessage>).detail);
    });
    events?.addEventListener("collab-navigated", () => sync.setNoteId(bootstrap.noteId));
    events?.addEventListener("collab-removed", () => sync.dispose());
}

/**
 * Keeps the editor on the server's version as others save it, a few times a second while they
 * type: their edits are merged into the guest's own around the caret, and the saves that follow
 * name the merged version as their base. Only edits that touch the same text as someone else's
 * wait for the conflict answer of the next save.
 */
function followRemoteChanges(
    bootstrap: CollabBootstrap, editor: EditorHandle | null, saver: GuestSaver
) {
    const announce = () => bootstrap.send?.({ type: "collab-editing", noteId: bootstrap.noteId });
    announce();
    bootstrap.events?.addEventListener("collab-open", announce);

    let following: Promise<void> | null = null;
    let again = false;
    const follow = () => {
        if (following) {
            again = true;
            return;
        }

        following = takeServerVersion(bootstrap, editor, saver)
            .catch((e) => console.error(e)) // eslint-disable-line no-console
            .finally(() => {
                following = null;

                if (again) {
                    again = false;
                    follow();
                }
            });
    };

    bootstrap.events?.addEventListener("collab-update", (event) => {
        const update = (event as CustomEvent<CollabUpdate>).detail;
        const mine = update.notes.find((note) => note.noteId === bootstrap.noteId);

        if (!mine) {
            return;
        }

        if (mine.isDeleted) {
            location.reload();
            return;
        }

        // Switched to another type elsewhere: the other editor only loads with the page.
        const retyped = (mine.type && mine.type !== bootstrap.type)
            || (mine.mime && mine.mime !== bootstrap.mime);

        if (retyped) {
            void saver.flush().then(() => location.reload());
            return;
        }

        const title = document.getElementById("title");

        if (title && document.activeElement !== title && title.textContent !== mine.title) {
            title.textContent = mine.title;
        }

        if (!editor || !mine.blobId || mine.blobId === saver.currentBlobId) {
            return;
        }

        if (mine.componentId === saver.componentId) {
            saver.adoptBlobId(mine.blobId);
            return;
        }

        if (!saver.conflict) {
            follow();
        }
    });
}

/** Loads the server's version of the open note into the editor, merged with the guest's edits. */
async function takeServerVersion(
    bootstrap: CollabBootstrap, editor: EditorHandle | null, saver: GuestSaver
) {
    // A save on its way names the current base; its answer moves the base on first.
    await saver.settled();
    const noteId = bootstrap.noteId;
    const known = saver.currentBlobId;
    const note = await fetchGuestNote(noteId);

    // A save that started meanwhile, or a switch of note, brings its own answer.
    if (!editor || note.content === null || !note.blobId || noteId !== bootstrap.noteId
        || note.blobId === known || known !== saver.currentBlobId || saver.conflict
        || saver.state === "saving") {
        return;
    }

    const base = saver.baseContent;

    if (base !== null && editor.merge?.(base, note.content)) {
        saver.adoptServerVersion(note.blobId, note.content);
    } else if (saver.state !== "pending") {
        editor.set(note.content);
        saver.adoptServerVersion(note.blobId, note.content);
    }
}

async function fetchGuestNote(noteId: string): Promise<GuestNote> {
    const response = await fetch(`api/notes/${encodeURIComponent(noteId)}`, {
        credentials: "same-origin"
    });

    if (!response.ok) {
        throw new Error(`Loading the note failed with HTTP ${response.status}.`);
    }

    return await response.json() as GuestNote;
}

/** Mounts the editor of the note's type; the editors of drawn types load with their notes. */
async function mountContentEditor(
    bootstrap: CollabBootstrap, host: HTMLElement, content: string, saver: GuestSaver
): Promise<EditorHandle> {
    const strings = bootstrap.strings;

    switch (bootstrap.type) {
        case "text":
            return await mountTextEditor(host, content, saver, strings.text_placeholder ?? "");
        case "mermaid": {
            const { default: mountMermaidEditor } =
                await import("./collab/editors/mermaid_editor.js");
            return mountMermaidEditor(host, content, saver, {
                placeholder: strings.diagram_placeholder ?? "",
                preview: strings.diagram_preview ?? "",
                views: {
                    source: strings.view_source ?? "",
                    split: strings.view_split ?? "",
                    preview: strings.view_preview ?? ""
                }
            });
        }
        case "canvas": {
            const { default: mountCanvasEditor } =
                await import("./collab/editors/canvas_editor.js");
            return mountCanvasEditor(host, content, saver, bootstrap.noteId);
        }
        case "mindMap": {
            const { default: mountMindMapEditor } =
                await import("./collab/editors/mind_map_editor.js");
            return mountMindMapEditor(host, content, saver, strings.mind_map_new_topic ?? "");
        }
        default:
            return mountCodeEditor(host, content, bootstrap.mime, saver,
                strings.code_placeholder ?? "", bootstrap.indentation);
    }
}

async function mountTextEditor(
    host: HTMLElement, content: string, saver: GuestSaver, placeholder: string
): Promise<EditorHandle> {
    host.classList.add("ck-content", "collab-editor-host");
    host.innerHTML = content;

    const editor = await GuestEditor.create(host, {
        licenseKey: "GPL",
        // The app's own wording, shown while the note is empty.
        placeholder,
        toolbar: { items: TOOLBAR_ITEMS },
        // Markup of the features a guest's editor does not carry survives the round trip as is.
        htmlSupport: { allow: [ { name: /.*/, attributes: true, classes: true, styles: true } ] },
        image: { toolbar: [ "imageStyle:inline", "imageStyle:block", "|", "toggleImageCaption" ] },
        link: { defaultProtocol: "https://" }
    });

    const toolbar = document.createElement("div");
    toolbar.className = "collab-editor-toolbar";
    toolbar.append(editor.ui.view.toolbar.element ?? document.createTextNode(""));
    // Under the tab row in the page's sticky header, where the app keeps its formatting toolbar.
    const header = document.getElementById("collab-header");

    if (header) {
        header.append(toolbar);
    } else {
        host.before(toolbar);
    }

    // Loading the server's version is not an edit to save back.
    let applyingRemote = false;
    editor.model.document.on("change:data", () => {
        if (!applyingRemote) {
            saver.scheduleContent(() => editor.getData());
        }
    });
    const applyRemote = (apply: () => void) => {
        applyingRemote = true;

        try {
            apply();
        } finally {
            applyingRemote = false;
        }
    };

    return {
        get: () => editor.getData(),
        set: (html) => applyRemote(() => editor.setData(html)),
        merge: (base, theirs) => mergeTextEditor(editor, base, theirs, applyRemote),
        focusStart: () => {
            placeCursorInNewTopParagraph(editor);
            editor.editing.view.focus();
        },
        cursors: textCursorAdapter(editor)
    };
}

function mountCodeEditor(
    host: HTMLElement, content: string, mime: string, saver: GuestSaver, placeholder: string,
    indentation: IndentStyle | null | undefined
): EditorHandle {
    host.classList.add("collab-code-host");
    host.replaceChildren();

    let applyingRemote = false;
    const editor = new CodeMirror({
        parent: host,
        lineWrapping: true,
        placeholder,
        ...(indentation ? { indentSize: indentation.width, useTabs: indentation.useTabs } : {}),
        onContentChanged: () => {
            if (!applyingRemote) {
                saver.scheduleContent(() => editor.getText());
            }
        }
    });
    // Loading the note, or the server's version of it, is no edit to save back.
    const set = (text: string) => {
        applyingRemote = true;

        try {
            editor.setText(text);
        } finally {
            applyingRemote = false;
        }
    };

    set(content);
    void editor.setMimeType(mime);
    themeCodeEditor(editor);

    return {
        get: () => editor.getText(),
        set,
        merge: (base, theirs) => mergeCode(editor, base, theirs, (apply) => {
            applyingRemote = true;

            try {
                apply();
            } finally {
                applyingRemote = false;
            }
        }),
        focusStart: () => editor.focus(),
        setMime: (nextMime) => void editor.setMimeType(nextMime),
        setIndentation: ({ width, useTabs }) => editor.setIndent(width, useTabs),
        reindent: (from, to) => reindentEditorText(editor, from, to),
        cursors: codeCursorAdapter(editor)
    };
}

interface Chrome {
    host: HTMLElement;
    onReload: () => void;
    onOverwrite: () => void;
    showState(state: GuestSaveState): void;
    notice(text: string): void;
}

/**
 * Adds the status line and, for a note with content to edit, replaces the rendered body with an
 * editor host under the conflict banner.
 */
function buildChrome(
    content: HTMLElement, strings: Record<string, string>, ownsContent: boolean
): Chrome {
    const status = document.createElement("div");
    status.className = "collab-status";
    status.textContent = strings.editing_hint ?? "";

    const conflict = document.createElement("div");
    conflict.className = "collab-conflict";
    conflict.hidden = true;
    const message = document.createElement("span");
    message.textContent = strings.conflict ?? "";
    const reload = document.createElement("button");
    reload.type = "button";
    reload.textContent = strings.reload ?? "";
    const overwrite = document.createElement("button");
    overwrite.type = "button";
    overwrite.textContent = strings.overwrite ?? "";
    conflict.append(message, reload, overwrite);

    const host = document.createElement("div");

    // In the row of buttons over the title, before them, where the app shows a note's save state.
    const actions = document.querySelector(".collab-title-actions .collab-people-toggle")
        ?? document.querySelector(".collab-title-actions .collab-note-options");
    actions?.before(status);

    if (ownsContent) {
        content.replaceChildren(...(actions ? [] : [ status ]), conflict, host);
    } else if (!actions) {
        content.prepend(status);
    }

    const chrome: Chrome = {
        host,
        onReload: () => {},
        onOverwrite: () => {},
        notice(text: string) {
            status.textContent = text;
        },
        showState(state: GuestSaveState) {
            conflict.hidden = state !== "conflict";

            if (state === "pending" || state === "saving") {
                status.textContent = strings.saving ?? "";
            } else if (state === "saved") {
                status.textContent = strings.saved ?? "";
            } else if (state === "error") {
                status.textContent = strings.save_failed ?? "";
            }
        }
    };

    reload.addEventListener("click", () => chrome.onReload());
    overwrite.addEventListener("click", () => chrome.onOverwrite());

    return chrome;
}

