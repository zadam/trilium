import { NOTE_TYPE_ICONS } from "@triliumnext/commons";
import ejs from "ejs";
import { t } from "i18next";
import { parse } from "node-html-parser";

import type BCollaboration from "../becca/entities/bcollaboration.js";
import type BNote from "../becca/entities/bnote.js";
import type { GuestCapability } from "../services/context.js";
import * as iconPackService from "../services/icon_packs.js";
import * as task_states from "../services/task_states.js";
import * as utils from "../services/utils/index.js";
import { assetUrlFragment, getContent, readShareTemplate } from "../share/content_renderer.js";
import {
    getGuestCodeLanguages, getNoteIndentation, type GuestCodeLanguage, isGuestEditableNote,
    isSafeColor, type NoteIndentation
} from "./guest_writes.js";
import { getPasswordGatedCapabilities, isNoteInCollabScope } from "./service.js";

/**
 * Every guest page sits two segments below the app root, at `/collab/<id>/` or
 * `/collab/<id>/<noteId>`, so the share theme's assets and the app's favicon are reached from here.
 */
const BASE_PATH = "../../";

/** What the page hands its scripts through `window.collab`. */
export interface CollabBootstrap {
    collabId: string;
    rootNoteId: string;
    noteId: string;
    title: string;
    /** The note's icon classes, for its tab. */
    iconClass: string;
    type: string;
    mime: string;
    blobId: string | null;
    /** Whether a guest who can edit may change this note's content and type. */
    editable: boolean;
    /** The languages a code note can switch to, for a guest who can edit; empty otherwise. */
    codeLanguages: GuestCodeLanguage[];
    /** How a code note indents, which the status bar shows and an editor can change. */
    indentation: NoteIndentation | null;
    /** The note's type as the page names it, and the app's icon for it, for the note info. */
    typeLabel: string;
    typeIcon: string;
    utcDateCreated: string;
    utcDateModified: string;
    includeSubtree: boolean;
    capabilities: readonly GuestCapability[];
    csrfToken: string | null;
    /** The page's own person in the list of people, or null until the page joins. */
    selfId: string | null;
    /** The editor's messages, translated here because the page's scripts have no catalogue. */
    strings: Record<string, string>;
}

export interface CollabPageOptions {
    capabilities: readonly GuestCapability[];
    /** The token the page's own forms and saves send; present once the session is persisted. */
    csrfToken: string | null;
    selfId: string | null;
    /** Whether the session unlocked a password, which the page then offers to forget. */
    canLogout: boolean;
}

const EDITOR_STRING_KEYS = [
    "saving", "saved", "save_failed", "conflict", "reload", "overwrite", "ended",
    "removed", "people", "you", "host_tag", "rename_self", "your_name", "editing_now",
    "change_own_color", "change_person_color", "default_color", "color_blue", "color_red",
    "color_green", "color_purple", "color_orange", "color_teal", "color_magenta", "color_olive",
    "add_child_note", "editing_hint", "full", "tabs", "close_tab",
    "change_color", "change_icon", "search_icons", "reset_icon",
    "clear_color", "set_color", "custom_color", "text_placeholder", "code_placeholder",
    "diagram_placeholder", "diagram_preview", "view_source", "view_split", "view_preview",
    "mind_map_new_topic", "options", "note_type_heading", "type_text", "type_code",
    "type_markdown", "type_mermaid", "type_canvas", "type_mind_map", "type_book", "language",
    "search_languages", "language_runs", "copy_link", "link_copied", "download", "print",
    "note_path", "tab_width_title", "tab_width_spaces_short", "tab_width_tabs",
    "tab_width_style_header", "tab_width_style_spaces", "tab_width_style_tabs",
    "tab_width_display_header", "tab_width_reindent_header", "note_info", "info_created",
    "info_modified", "info_type", "info_mime", "info_note_id", "info_note_size",
    "info_note_size_hint", "info_calculate"
];

/** The indentation widths the status bar offers, as the app's does. */
const TAB_WIDTHS = [ 1, 2, 3, 4, 6, 8 ];

export interface GuestTreeNode {
    noteId: string;
    title: string;
    type: string;
    children: GuestTreeNode[];
}

export interface GuestNote {
    noteId: string;
    title: string;
    type: string;
    mime: string;
    blobId: string | null;
    utcDateModified: string;
    /** The note's content, for the types that the guest page has an editor for. */
    content: string | null;
}

/** The types whose content the guest page's editors load. */
const GUEST_CONTENT_TYPES = new Set([ "text", "code", "mermaid", "canvas", "mindMap" ]);

export function renderCollabPage(
    collab: BCollaboration, note: BNote, options: CollabPageOptions
): string {
    const rootNote = collab.getNote();

    if (!rootNote) {
        throw new Error(`Collaboration '${collab.collabId}' points at a missing note.`);
    }

    // The capabilities a password on this page could still add; the page offers to enter one.
    // A guest who passed the view prompt already entered the one password they have, so only
    // an open view, which never prompted, offers the form.
    const unlockable = collab.viewMode === "open"
        ? getPasswordGatedCapabilities(collab)
            .filter((capability) => !options.capabilities.includes(capability))
        : [];
    const { header, content, isEmpty } = getContent(note, { includesAsReferenceLinks: true });
    const iconPacks = iconPackService.getIconPacks().filter((pack) => pack.builtin);
    const treeParams = getTreeParams(collab, rootNote, note, options.capabilities);
    const titleColor = getNoteColor(note);
    const bootstrap: CollabBootstrap = {
        collabId: collab.collabId ?? "",
        rootNoteId: rootNote.noteId,
        noteId: note.noteId,
        title: note.title,
        iconClass: note.getIcon(),
        type: note.type,
        mime: note.mime,
        blobId: note.blobId ?? null,
        editable: isGuestEditableNote(note),
        codeLanguages: options.capabilities.includes("edit") ? getGuestCodeLanguages() : [],
        indentation: getNoteIndentation(note),
        typeLabel: getTypeLabel(note),
        typeIcon: NOTE_TYPE_ICONS[note.type as keyof typeof NOTE_TYPE_ICONS] ?? "bx bx-note",
        utcDateCreated: toIsoDate(note.utcDateCreated),
        utcDateModified: toIsoDate(note.utcDateModified ?? note.utcDateCreated),
        includeSubtree: collab.includeSubtree,
        capabilities: options.capabilities,
        csrfToken: options.csrfToken,
        selfId: options.selfId,
        strings: {
            ...Object.fromEntries(
                EDITOR_STRING_KEYS.map((key) => [ key, t(`collab_theme.${key}`) ])),
            ...Object.fromEntries(TAB_WIDTHS.map((width) =>
                [ `tab_width_${width}`, t("collab_theme.tab_width_spaces", { count: width }) ])),
            back: t("hidden-subtree.go-to-previous-note-title"),
            forward: t("hidden-subtree.go-to-next-note-title")
        }
    };

    return ejs.render(readShareTemplate("collab"), {
        collab,
        note,
        header,
        content: typeof content === "string" ? content : "",
        isEmpty,
        ...treeParams,
        childCards: getChildCards(collab, note),
        typeLabel: getTypeLabel(note),
        noteIconClass: note.getIcon(),
        titleColor,
        titleHasHue: titleColor !== null && hasHue(titleColor),
        canChangeAppearance: options.capabilities.includes("edit"),
        capabilities: options.capabilities,
        unlockable,
        returnTo: note.noteId === rootNote.noteId ? "" : note.noteId,
        canLogout: options.canLogout,
        csrfToken: options.csrfToken ?? "",
        bootstrapJson: toInlineJson(bootstrap),
        ...getPageAssets(),
        iconPackCss: [
            INTER_FONT_FACE,
            ...iconPacks.map((pack) => iconPackService.generateCss(pack, getFontUrl(pack))),
            iconPackService.generateIconTransformCss(),
            task_states.generateTaskStateCss()
        ].filter(Boolean).join("\n\n"),
        t,
        utils
    }, TEMPLATE_OPTIONS);
}

/**
 * What a page swaps in to show a change: the tree, the cards of the shown note's children, and
 * the note's own icon and color.
 */
export interface CollabTreeMenu {
    html: string;
    childrenHtml: string;
    iconClass: string;
    color: string | null;
    hasHue: boolean;
}

export function renderCollabTreeMenu(
    collab: BCollaboration, note: BNote, capabilities: readonly GuestCapability[]
): CollabTreeMenu {
    const rootNote = collab.getNote();

    if (!rootNote) {
        throw new Error(`Collaboration '${collab.collabId}' points at a missing note.`);
    }

    const color = getNoteColor(note);

    return {
        html: ejs.render(readShareTemplate("collab_tree"), {
            ...getTreeParams(collab, rootNote, note, capabilities),
            t
        }, TEMPLATE_OPTIONS),
        childrenHtml: ejs.render(readShareTemplate("collab_note_list"), {
            cards: getChildCards(collab, note),
            t
        }, TEMPLATE_OPTIONS),
        iconClass: note.getIcon(),
        color,
        hasHue: color !== null && hasHue(color)
    };
}

/** A child note as a card in the list under its parent's body. */
export interface GuestNoteCard {
    noteId: string;
    title: string;
    type: string;
    iconClass: string;
    color: string | null;
    /** The start of the note's content, rendered as its own page renders it; empty for none. */
    preview: string;
}

const PREVIEW_BLOCKS = 6;
/** The types whose page shows a picture, which their card shows too. */
const PICTURE_TYPES = new Set([ "image", "mermaid", "canvas", "mindMap" ]);
const PREVIEW_CODE_LINES = 12;

/**
 * The cards of the children a guest can see, for the list the app shows under a text, code or
 * collection note that has children.
 */
export function getChildCards(collab: BCollaboration, note: BNote): GuestNoteCard[] {
    const listsChildren = [ "text", "code", "book" ].includes(note.type)
        && note.mime !== "text/x-sqlite;schema=trilium";

    if (!listsChildren) {
        return [];
    }

    return getVisibleChildren(collab, note).map((child) => ({
        noteId: child.noteId,
        title: child.title,
        type: child.type,
        iconClass: child.getIcon(),
        color: getNoteColor(child),
        preview: getPreview(child)
    }));
}

const ACHROMATIC_COLOR_NAMES = new Set([
    "black", "white", "gray", "grey", "silver", "gainsboro", "whitesmoke", "dimgray", "dimgrey",
    "darkgray", "darkgrey", "lightgray", "lightgrey", "transparent", "currentcolor"
]);

/**
 * Whether a color has a hue to tint the note's icon with, as the app's `getHue()` decides: a gray,
 * white or black has none. A color written as a function is taken to have one.
 */
export function hasHue(color: string): boolean {
    const value = color.trim().toLowerCase();
    const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(value)?.[1];

    if (hex) {
        const channels = hex.length <= 4 ? [ ...hex.slice(0, 3) ] : hex.slice(0, 6).match(/../g);

        return new Set(channels).size > 1;
    }

    return !ACHROMATIC_COLOR_NAMES.has(value);
}

/** The password prompt; `returnTo` is the note id to land on afterwards, or "" for the root. */
export function renderCollabLogin(options: { error: boolean; returnTo: string }): string {
    return ejs.render(readShareTemplate("collab_login"), {
        ...getPageAssets(),
        error: options.error,
        returnTo: options.returnTo,
        t
    }, TEMPLATE_OPTIONS);
}

/** The page a guest gets while the collaboration holds as many guests as it admits. */
export function renderCollabFull(collab: BCollaboration): string {
    return ejs.render(readShareTemplate("collab_full"), {
        ...getPageAssets(),
        maxGuests: collab.maxGuests,
        t
    });
}

export function renderCollab404(): string {
    return ejs.render(readShareTemplate("404"), { t });
}

/** The in-scope tree under the collaboration's note, for the page's navigation. */
export function buildGuestTree(collab: BCollaboration, note: BNote): GuestTreeNode {
    return {
        noteId: note.noteId,
        title: note.title,
        type: note.type,
        children: getVisibleChildren(collab, note).map((child) => buildGuestTree(collab, child))
    };
}

export function serializeNoteForGuest(note: BNote): GuestNote {
    const content = GUEST_CONTENT_TYPES.has(note.type) ? note.getContent() : null;

    return {
        noteId: note.noteId,
        title: note.title,
        type: note.type,
        mime: note.mime,
        blobId: note.blobId ?? null,
        utcDateModified: note.utcDateModified ?? note.utcDateCreated,
        content: typeof content === "string" ? content : null
    };
}

const TEMPLATE_OPTIONS = {
    includer: (path: string) => ({ template: readShareTemplate(path) })
};

/** What `collab_tree.ejs` draws the tree from, with `activeNote` marked and its ancestors open. */
function getTreeParams(
    collab: BCollaboration, rootNote: BNote, activeNote: BNote,
    capabilities: readonly GuestCapability[]
) {
    return {
        rootNote,
        activeNote,
        ancestors: getAncestorsWithin(collab, activeNote),
        visibleChildren: (parent: BNote) => getVisibleChildren(collab, parent),
        canCreate: capabilities.includes("create") && collab.includeSubtree,
        noteColor: getNoteColor,
        iconPackSupportedPrefixes: iconPackService.getIconPacks()
            .filter((pack) => pack.builtin)
            .map((pack) => pack.prefix)
    };
}

/** The first blocks of a text note, the first lines of a code note, or an image note's image. */
function getPreview(note: BNote): string {
    if (note.type === "code") {
        const content = note.getContent();

        return typeof content === "string" && content.trim()
            ? `<pre>${utils.escapeHtml(firstLines(content, PREVIEW_CODE_LINES))}</pre>`
            : "";
    }

    if (note.type !== "text" && !PICTURE_TYPES.has(note.type)) {
        return "";
    }

    const { content, isEmpty } = getContent(note, { includesAsReferenceLinks: true });

    if (isEmpty || typeof content !== "string") {
        return "";
    }

    // The picture alone, without the source that a diagram's page lists under it.
    return PICTURE_TYPES.has(note.type)
        ? parse(content).querySelector("img")?.toString() ?? ""
        : parse(content).childNodes.slice(0, PREVIEW_BLOCKS).map(String).join("");
}

function firstLines(text: string, count: number): string {
    return text.split("\n").slice(0, count).join("\n");
}

/** The names the note options menu gives the types it offers, by type. */
const TYPE_LABEL_KEYS: Record<string, string> = {
    text: "type_text",
    code: "type_code",
    mermaid: "type_mermaid",
    canvas: "type_canvas",
    mindMap: "type_mind_map",
    book: "type_book"
};

/** The note's type as the app names it; a type the menu does not offer shows as it is stored. */
function getTypeLabel(note: BNote): string {
    const key = note.isMarkdown() ? "type_markdown" : TYPE_LABEL_KEYS[note.type];

    return key ? t(`collab_theme.${key}`) : note.type;
}

/** A UTC date as Trilium stores it, `2026-10-02 14:03:17.123Z`, in the ISO form a page parses. */
function toIsoDate(utcDate: string | undefined) {
    return (utcDate ?? "").replace(" ", "T");
}

/** The note's `color` label when it is a plain CSS color, which the page can put in a style. */
function getNoteColor(note: BNote): string | null {
    const color = note.getLabelValue("color");

    return isSafeColor(color) ? color : null;
}

/** The children a guest can see: the note's visible children that are in scope. */
function getVisibleChildren(collab: BCollaboration, note: BNote): BNote[] {
    if (!collab.includeSubtree) {
        return [];
    }

    return note.getVisibleChildNotes().filter((child) => isNoteInCollabScope(collab, child));
}

/** The ids between the note and the collaboration's note, nearest first, for expanding the tree. */
function getAncestorsWithin(collab: BCollaboration, note: BNote): string[] {
    const ancestors: string[] = [];
    const seen = new Set<string>();
    let pointer = note;

    while (pointer.noteId !== collab.noteId && !seen.has(pointer.noteId)) {
        seen.add(pointer.noteId);

        const parent = pointer.parents.find((candidate) =>
            candidate.noteId === collab.noteId || candidate.hasAncestor(collab.noteId));

        if (!parent) {
            break;
        }

        if (parent.noteId !== collab.noteId) {
            ancestors.push(parent.noteId);
        }

        pointer = parent;
    }

    return ancestors;
}

function getPageAssets() {
    return {
        basePath: BASE_PATH,
        cssToLoad: [
            `${BASE_PATH}share/assets/styles.css`,
            `${BASE_PATH}share/assets/scripts.css`
        ],
        jsToLoad: [ `${BASE_PATH}share/assets/scripts.js` ],
        faviconUrl: `${BASE_PATH}favicon.ico`,
        logoUrl: `${BASE_PATH}${assetUrlFragment}/images/icon-color.svg`
    };
}

/** The app's own font, which the page's tree is set in as the app's tree is. */
const INTER_FONT_FACE = `@font-face {
    font-family: "Inter";
    src: url("${BASE_PATH}share/assets/fonts/Inter/Inter-VariableFont_opsz,wght.woff2")
        format("woff2-variations");
    font-weight: 100 900;
    font-style: normal;
    font-display: swap;
}`;

function getFontUrl(pack: iconPackService.ProcessedIconPack): string {
    const extension = iconPackService.MIME_TO_EXTENSION_MAPPINGS[pack.fontMime];

    return `${BASE_PATH}share/assets/fonts/${pack.fontAttachmentId}.${extension}`;
}

/** JSON that is safe inside a `<script>` element: `<` never closes it. */
function toInlineJson(value: unknown): string {
    return JSON.stringify(value).replace(/</g, "\\u003c");
}
