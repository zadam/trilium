import {
    type IconRegistry, MIME_TYPES_DICT, NOTE_TYPE_IMAGE_ATTACHMENTS, type NoteType
} from "@triliumnext/commons";
import { parse } from "node-html-parser";
import type sanitizeHtml from "sanitize-html";

import type BCollaboration from "../becca/entities/bcollaboration.js";
import type BNote from "../becca/entities/bnote.js";
import { PayloadTooLargeError, ValidationError } from "../errors.js";
import { generateIconRegistry, getIconPacks } from "../services/icon_packs.js";
import noteService from "../services/notes.js";
import optionService from "../services/options.js";
import * as sanitize from "../services/sanitizer.js";
import { isNoteInCollabScope } from "./service.js";

/** The largest content a guest save accepts, in UTF-16 code units. */
export const MAX_GUEST_CONTENT_LENGTH = 2 * 1024 * 1024;

/**
 * The largest preview a guest save stores. A canvas carries its pictures inside its preview, so the
 * preview gets more room than the content.
 */
export const MAX_GUEST_PREVIEW_LENGTH = 4 * MAX_GUEST_CONTENT_LENGTH;

/** The types besides code that the guest page has an editor for, with the app's mime of each. */
const GUEST_TYPES: readonly (readonly [ NoteType, string ])[] = [
    [ "text", "text/html" ],
    [ "mermaid", "text/mermaid" ],
    [ "canvas", "application/json" ],
    [ "mindMap", "application/json" ],
    [ "book", "" ]
];

/** The mime of the app's Markdown type, a code note offered whatever languages the host picked. */
const MARKDOWN_MIME = "text/x-markdown";

const MAX_TITLE_LENGTH = 1000;

export type GuestSaveResult =
    | { ok: true; blobId: string; utcDateModified: string }
    /** The note moved on since the guest loaded it; `current` is what the server holds now. */
    | { ok: false; current: { blobId: string; content: string } };

/**
 * Guests edit the types the guest page has an editor for and code that the host's app does not
 * run, and never a note the host marked read-only.
 */
export function isGuestEditableNote(note: BNote): boolean {
    const editableType = note.type === "code"
        ? !isRunnableCode(note.mime)
        : GUEST_TYPES.some(([ type ]) => type === note.type);

    return editableType && note.isContentAvailable() && !note.isLabelTruthy("readOnly");
}

/**
 * Code the host's app runs or renders as a page: Trilium's frontend and backend scripts, JSX, the
 * SQL console, and HTML, which a Render note shows. A guest never edits such a note or turns a
 * note into one. Plain JavaScript (`text/javascript`) has no script environment, so
 * `BNote.getScriptEnv()` leaves it out of every run and script bundle, and a guest can edit it.
 */
function isRunnableCode(mime: string): boolean {
    return mime.startsWith("application/javascript") || mime === "application/x-javascript"
        || mime === "text/jsx" || mime === "text/x-sqlite;schema=trilium" || mime === "text/html";
}

/** A language of the app's list for code notes. */
export interface GuestCodeLanguage {
    mime: string;
    title: string;
    /** Whether Trilium runs code in this language, which leaves choosing it to the host. */
    runs: boolean;
}

/**
 * The languages the app lists for code notes, as its `mime_types` service reads them: those the
 * host enabled in the code-notes options, or the app's defaults without that setting, and plain
 * text, in the app's order. A guest can choose any of them but the ones Trilium runs.
 */
export function getGuestCodeLanguages(): GuestCodeLanguage[] {
    const enabled = readEnabledLanguages();

    return MIME_TYPES_DICT
        .filter((language) => language.mime === "text/plain"
            || (enabled ? enabled.has(language.mime) : !!language.default))
        .map(({ mime, title }) => ({ mime, title, runs: isRunnableCode(mime) }));
}

/** The `codeNotesMimeTypes` option, or null where it holds no list. */
function readEnabledLanguages(): Set<string> | null {
    const stored = parseJsonOrNull(optionService.getOptionOrNull("codeNotesMimeTypes") ?? "");

    return Array.isArray(stored)
        ? new Set(stored.filter((mime): mime is string => typeof mime === "string"))
        : null;
}

/**
 * Switches the note to another type the guest page has an editor for, as the app's type switch
 * does: the content stays as it is. The note's state before is kept as a revision.
 */
export function changeTypeAsGuest(
    note: BNote, type: unknown, mime: unknown
): { type: string; mime: string } {
    const target = getGuestTypeTarget(type, mime);

    if (!isGuestEditableNote(note) || !target) {
        throw new ValidationError(
            "Guests can only switch a note to the types and code languages offered.");
    }

    if (note.type !== target.type || note.mime !== target.mime) {
        noteService.saveRevisionIfNeeded(note, "collab");
        note.type = target.type;
        note.mime = target.mime;
        note.save();
    }

    return { type: note.type, mime: note.mime };
}

/** The type and mime a guest asked for, when the guest page has an editor for them. */
function getGuestTypeTarget(type: unknown, mime: unknown): { type: NoteType; mime: string } | null {
    if (typeof mime !== "string") {
        return null;
    }

    if (type === "code") {
        const offered = mime === MARKDOWN_MIME || getGuestCodeLanguages()
            .some((language) => language.mime === mime && !language.runs);

        return offered ? { type: "code", mime } : null;
    }

    const match = GUEST_TYPES.find(([ guestType, guestMime ]) =>
        guestType === type && guestMime === mime);

    return match ? { type: match[0], mime: match[1] } : null;
}

/**
 * Reduces what a guest sent to what a guest may store. Code and Mermaid diagrams are plain text and
 * are kept as sent; a canvas must be a JSON object; a collection has no content to save.
 */
export function sanitizeGuestContent(note: BNote, content: string): string {
    switch (note.type) {
        case "text":
            return sanitizeGuestHtml(content);
        case "canvas":
            parseJsonObject(content);
            return content;
        case "mindMap":
            return sanitizeMindMap(note, parseJsonObject(content));
        case "book":
            throw new ValidationError("Collections have no content to save.");
        default:
            return content;
    }
}

/**
 * Runs HTML through the same sanitizer as imported and clipped HTML, and then drops inline `data:`
 * images and include-note sections, which are the two ways content can smuggle in an attachment
 * or another note.
 */
function sanitizeGuestHtml(html: string): string {
    const document = parse(sanitize.sanitizeHtml(html));

    for (const image of document.querySelectorAll("img")) {
        if ((image.getAttribute("src") ?? "").trim().toLowerCase().startsWith("data:")) {
            image.remove();
        }
    }

    for (const include of document.querySelectorAll("section.include-note")) {
        include.remove();
    }

    return document.toString();
}

/**
 * Keeps a mind map to plain data. Mind Elixir writes `dangerouslySetInnerHTML` and the labels of
 * arrows and summaries into the page as HTML, so the first is dropped and the labels keep only
 * their text, escaped. Memos written as HTML go through the text sanitizer, and a link whose
 * scheme runs code is dropped.
 *
 * A node keeps a picture only when the map already held it: when the host's app saves the map, it
 * inlines every picture into the preview that guests see, so a new address could pull in a
 * picture of a note the collaboration does not open.
 */
function sanitizeMindMap(note: BNote, map: Record<string, unknown>): string {
    const heldPictures = new Set<string>();

    forEachRecord(parseJsonOrNull(readText(note)), (record) => {
        const url = getPictureUrl(record);

        if (url) {
            heldPictures.add(url);
        }
    });

    forEachRecord(map, (record) => {
        delete record.dangerouslySetInnerHTML;

        if ("image" in record && !heldPictures.has(getPictureUrl(record) ?? "")) {
            delete record.image;
        }

        if (typeof record.hyperLink === "string"
            && sanitize.sanitizeUrl(record.hyperLink) === "about:blank") {
            delete record.hyperLink;
        }

        // A memo without markup is plain text, which the app escapes when it shows it.
        if (typeof record.memo === "string" && /<[a-z][\s\S]*>/i.test(record.memo)) {
            record.memo = sanitizeGuestHtml(record.memo);
        }

        if (typeof record.label === "string") {
            record.label = sanitize.sanitizeHtmlCustom(record.label, {
                allowedTags: [],
                allowedAttributes: {}
            });
        }
    });

    return JSON.stringify(map);
}

function getPictureUrl(record: Record<string, unknown>): string | null {
    const image = record.image;

    return isRecord(image) && typeof image.url === "string" ? image.url : null;
}

/** Calls `visit` on every object inside `value`, `value` included, before descending into it. */
function forEachRecord(value: unknown, visit: (record: Record<string, unknown>) => void) {
    if (Array.isArray(value)) {
        for (const item of value) {
            forEachRecord(item, visit);
        }

        return;
    }

    if (isRecord(value)) {
        visit(value);

        for (const child of Object.values(value)) {
            forEachRecord(child, visit);
        }
    }
}

function parseJsonObject(content: string): Record<string, unknown> {
    const parsed = parseJsonOrNull(content);

    if (!isRecord(parsed)) {
        throw new ValidationError("The content must be a JSON object.");
    }

    return parsed;
}

function parseJsonOrNull(content: string): unknown {
    try {
        return JSON.parse(content);
    } catch {
        return null;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Saves content a guest edited. With `baseBlobId`, the save only lands when the note still holds
 * that content; otherwise the caller gets the current content back to reconcile against. A
 * diagram, canvas or mind map also stores `preview`, the SVG the guest's editor drew of it.
 *
 * `saveLinks` is deliberately not run: it fetches remote images on the server, turns `data:`
 * images into attachments and writes relations, none of which a guest may cause. Internal links
 * a guest pastes stay inert until the host next saves the note.
 */
export function updateContentAsGuest(
    note: BNote, content: string, baseBlobId: string | null, preview?: string | null
): GuestSaveResult {
    assertGuestEditable(note);

    if (content.length > MAX_GUEST_CONTENT_LENGTH) {
        throw new PayloadTooLargeError("The content is too large for a guest save.");
    }

    const cleanContent = sanitizeGuestContent(note, content);

    if (baseBlobId !== null && note.blobId !== baseBlobId) {
        return { ok: false, current: { blobId: note.blobId ?? "", content: readText(note) } };
    }

    noteService.saveRevisionIfNeeded(note, "collab");
    note.setContent(cleanContent);
    saveGuestPreview(note, preview);

    return {
        ok: true,
        blobId: note.blobId ?? "",
        utcDateModified: note.utcDateModified ?? note.utcDateCreated
    };
}

/**
 * Stores the picture a guest's editor drew of a diagram, canvas or mind map under the title the
 * share page and `api/images` read it from, as the app's editors do. A preview that is too large
 * or is not an SVG is left out, so the content still saves and the previous picture stays.
 */
function saveGuestPreview(note: BNote, preview: string | null | undefined) {
    const title = note.type === "mermaid" || note.type === "canvas" || note.type === "mindMap"
        ? NOTE_TYPE_IMAGE_ATTACHMENTS[note.type]
        : null;

    if (!title || !preview || preview.length > MAX_GUEST_PREVIEW_LENGTH) {
        return;
    }

    const svg = sanitizeGuestSvg(preview);

    if (svg) {
        note.saveAttachment({
            role: "image",
            mime: "image/svg+xml",
            title,
            content: svg,
            position: 0
        }, "title");
    }
}

/** The SVG elements a preview is drawn with, and the HTML that Mermaid puts in its labels. */
const PREVIEW_TAGS = [
    "svg", "g", "defs", "symbol", "use", "title", "desc", "a", "style", "switch",
    "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
    "text", "tspan", "textPath", "image", "foreignObject",
    "marker", "clipPath", "mask", "pattern", "linearGradient", "radialGradient", "stop",
    "filter", "feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feDropShadow",
    "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feMerge",
    "feMergeNode", "feMorphology", "feOffset",
    "div", "span", "p", "br", "b", "strong", "i", "em", "u", "s", "code", "small", "sub", "sup",
    "ul", "ol", "li", "img"
];

const PREVIEW_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: PREVIEW_TAGS,
    // Every attribute but event handlers and `xml:base`, which the transform below drops.
    allowedAttributes: false,
    // A preview needs its `<style>`; the filter below drops one that holds markup.
    allowVulnerableTags: true,
    parseStyleAttributes: false,
    allowedSchemes: [ "http", "https", "mailto" ],
    allowedSchemesByTag: { image: [ "data" ], img: [ "data" ] },
    allowedSchemesAppliedToAttributes: [ "href", "xlink:href", "src" ],
    selfClosing: [ "br", "img" ],
    parser: { xmlMode: true },
    transformTags: {
        "*": (tagName, attribs) => ({
            tagName,
            attribs: Object.fromEntries(Object.entries(attribs).filter(([ name ]) =>
                !/^on/i.test(name) && name.toLowerCase() !== "xml:base"))
        })
    },
    exclusiveFilter: (frame) => frame.tag === "style" && frame.text.includes("<")
};

/**
 * Keeps only what an SVG preview is drawn with: an allowlist of elements, no event handlers, links
 * only to web pages and images only from `data:`. Returns null for what is not an SVG.
 */
export function sanitizeGuestSvg(svg: string): string | null {
    const clean = sanitize.sanitizeHtmlCustom(svg, PREVIEW_OPTIONS)
        // The sanitizer writes a style's text decoded; the file is read as XML, so `&` is escaped.
        .replace(/(<style\b[^>]*>)([^<]*)(<\/style>)/g, (_match, open: string, css: string,
            close: string) => `${open}${css.replaceAll("&", "&amp;")}${close}`)
        .trim();

    return /^<svg[\s>]/.test(clean) ? clean : null;
}

export function updateTitleAsGuest(note: BNote, title: string): { title: string } {
    assertGuestEditable(note);

    const cleanTitle = sanitize.sanitizeHtml(title).trim();
    assertValidTitle(cleanTitle);

    note.title = cleanTitle;
    note.save();

    return { title: note.title };
}

/** Creates an empty text note under a parent inside the collaboration. */
/**
 * Adds a text note under `parent`. Without a title it is named as the app names a new note:
 * "New note", or the parent's `titleTemplate`.
 */
export function createChildAsGuest(collab: BCollaboration, parent: BNote, title?: string) {
    if (!collab.includeSubtree || !isNoteInCollabScope(collab, parent)) {
        throw new ValidationError("Child notes can only be added inside the collaboration.");
    }

    const cleanTitle = title?.trim() ?? noteService.getNewNoteTitle(parent);
    assertValidTitle(cleanTitle);

    const { note } = noteService.createNewNote({
        parentNoteId: parent.noteId,
        title: cleanTitle,
        content: "",
        type: "text"
    });

    return { noteId: note.noteId, title: note.title };
}

export interface GuestAppearance {
    /** A CSS color for the note's title and tree row, or null to clear it. */
    color?: string | null;
    /** The icon's classes, e.g. `bx bx-star`, or null for the default icon. */
    iconClass?: string | null;
}

const COLOR_FUNCTIONS = "rgba?|hsla?|hwb|lab|lch|oklab|oklch";
const COLOR_PATTERN = new RegExp(
    `^(#[0-9a-f]{3,8}|[a-z]{3,24}|(${COLOR_FUNCTIONS})\\([0-9a-z.,%\\s/+-]{1,64}\\))$`, "i");

let guestIconRegistry: IconRegistry | null = null;
let guestIconClasses: Set<string> | null = null;

/** Whether the value is a plain CSS color a page can safely put in a style attribute. */
export function isSafeColor(value: string | null | undefined): value is string {
    return typeof value === "string" && COLOR_PATTERN.test(value);
}

/**
 * Sets or clears the note's `color` and `iconClass` labels; besides a code note's indentation
 * labels, these are the only attributes a guest can touch. A field left undefined stays as it is.
 * Returns what the note now carries.
 */
export function updateAppearanceAsGuest(
    note: BNote, appearance: GuestAppearance
): { color: string | null; iconClass: string | null } {
    if (note.isProtected) {
        throw new ValidationError("Guests cannot change protected notes.");
    }

    if (appearance.color !== undefined) {
        if (appearance.color !== null && !isSafeColor(appearance.color)) {
            throw new ValidationError("color must be a plain CSS color.");
        }

        setOrRemoveLabel(note, "color", appearance.color);
    }

    if (appearance.iconClass !== undefined) {
        if (appearance.iconClass !== null && !isGuestIcon(appearance.iconClass)) {
            throw new ValidationError("iconClass must be one of the built-in icons.");
        }

        setOrRemoveLabel(note, "iconClass", appearance.iconClass);
    }

    return {
        color: note.getLabelValue("color"),
        iconClass: note.getLabelValue("iconClass")
    };
}

/** How a code note indents: its width in columns, and whether a level is a tab. */
export interface NoteIndentation {
    width: number;
    useTabs: boolean;
}

/** The widest indentation a guest can set, past any of the app's offered widths. */
const MAX_TAB_WIDTH = 16;

/**
 * A code note's indentation, as the app's status bar reads it: the note's `tabWidth` and
 * `indentWithTabs` labels, else the code-notes options. Null for the other note types, which the
 * app's status bar offers no indentation for.
 */
export function getNoteIndentation(note: BNote): NoteIndentation | null {
    if (note.type !== "code") {
        return null;
    }

    const labelWidth = Number.parseInt(note.getLabelValue("tabWidth") ?? "", 10);
    const labelTabs = note.getLabelValue("indentWithTabs");
    const optionWidth =
        Number.parseInt(optionService.getOptionOrNull("codeNoteTabWidth") ?? "", 10);

    return {
        width: labelWidth > 0 ? labelWidth : (optionWidth > 0 ? optionWidth : 4),
        useTabs: labelTabs !== null
            ? labelTabs !== "false"
            : optionService.getOptionOrNull("codeNoteIndentWithTabs") === "true"
    };
}

/**
 * Sets or clears a code note's `tabWidth` and `indentWithTabs` labels, which only change how the
 * note indents; a field left undefined stays, and null goes back to the code-notes options.
 * Returns the indentation the note now has.
 */
export function updateIndentationAsGuest(
    note: BNote, indentation: { width?: number | null; useTabs?: boolean | null }
): NoteIndentation {
    assertGuestEditable(note);

    if (note.type !== "code") {
        throw new ValidationError("Only code notes have an indentation to set.");
    }

    const { width, useTabs } = indentation;

    if (width !== undefined && width !== null
        && !(Number.isInteger(width) && width >= 1 && width <= MAX_TAB_WIDTH)) {
        throw new ValidationError(`width must be a whole number from 1 to ${MAX_TAB_WIDTH}.`);
    }

    if (width !== undefined) {
        setOrRemoveLabel(note, "tabWidth", width === null ? null : String(width));
    }

    if (useTabs !== undefined) {
        setOrRemoveLabel(note, "indentWithTabs", useTabs === null ? null : String(useTabs));
    }

    return getNoteIndentation(note) ?? { width: 4, useTabs: false };
}

/** The icons a guest can pick: the built-in packs, never the host's own icon pack notes. */
export function getGuestIconRegistry(): IconRegistry {
    guestIconRegistry ??= generateIconRegistry(getIconPacks().filter((pack) => pack.builtin));

    return guestIconRegistry;
}

function isGuestIcon(iconClass: string) {
    guestIconClasses ??= new Set(getGuestIconRegistry().sources
        .flatMap((source) => source.icons.map((icon) => icon.id)));

    return guestIconClasses.has(iconClass);
}

function setOrRemoveLabel(note: BNote, name: string, value: string | null) {
    if (value === null) {
        note.removeLabel(name);
    } else {
        note.setLabel(name, value);
    }
}

function assertGuestEditable(note: BNote) {
    if (!isGuestEditableNote(note)) {
        throw new ValidationError(
            "Guests can only edit the note types offered, in notes that are not read-only.");
    }
}

function assertValidTitle(title: string) {
    if (!title || title.length > MAX_TITLE_LENGTH) {
        throw new ValidationError(
            `The title must be between 1 and ${MAX_TITLE_LENGTH} characters.`);
    }
}

function readText(note: BNote): string {
    const content = note.getContent();

    return typeof content === "string" ? content : "";
}

export default {
    changeTypeAsGuest,
    getGuestCodeLanguages,
    getNoteIndentation,
    updateIndentationAsGuest,
    updateAppearanceAsGuest,
    getGuestIconRegistry,
    isGuestEditableNote,
    sanitizeGuestContent,
    sanitizeGuestSvg,
    updateContentAsGuest,
    updateTitleAsGuest,
    createChildAsGuest
};
