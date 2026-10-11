import "@/assets/theme.css";
import "./popup.css";

import type { IconData, IconDefinition, IconPack } from "@boxicons/js";
import AlignLeft from "@boxicons/js/icons/AlignLeft";
import Article from "@boxicons/js/icons/Article";
import Bookmark from "@boxicons/js/icons/Bookmark";
import Cog from "@boxicons/js/icons/Cog";
import Crop from "@boxicons/js/icons/Crop";
import Globe from "@boxicons/js/icons/Globe";
import HelpCircle from "@boxicons/js/icons/HelpCircle";
import Highlight from "@boxicons/js/icons/Highlight";
import Lock from "@boxicons/js/icons/Lock";
import RefreshCw from "@boxicons/js/icons/RefreshCw";
import Screenshot from "@boxicons/js/icons/Screenshot";
import Tabs from "@boxicons/js/icons/Tabs";
import Unlink from "@boxicons/js/icons/Unlink";
import Youtube from "@boxicons/js/icons/Youtube";
import monospaceFontUrl from "@triliumnext/client/src/fonts/JetBrainsMono-Light.woff2?url";
import type { ComponentChildren } from "preact";
import { Fragment, render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { extractReadablePage, type ReadablePage } from "@/utils";

import type { TriliumSearchNoteStatus, TriliumSearchStatus } from "../background/trilium_server_facade";

const HELP_URL = "https://docs.triliumnotes.org/user-guide/setup/web-clipper";
const DISCONNECTED_TITLE = "This action can't be performed without active connection to Trilium.";
const UNREACHABLE_TITLE = "This action is not available on this page.";

type PopupMessage = {
    name: "trilium-search-status";
    triliumSearch?: TriliumSearchStatus;
} | {
    name: "trilium-previously-visited";
    searchNote: TriliumSearchNoteStatus;
};

/** The keyboard shortcut of each command, by command name; unbound commands are absent. */
type Shortcuts = Record<string, string>;

/** Content as the content script reads it from the page, its images referenced in `content` by `imageId`. */
interface SelectedContent {
    title: string;
    content: string;
    images: { imageId: string, src: string }[];
    pageUrl: string;
    labels?: Record<string, string>;
}

/** The current page: its readable version, or why there is none. */
type PageState = ReadablePage | "unreadable" | "inaccessible";

/** What the active tab offers to save. */
interface TabContent {
    page: PageState;
    /** `null` when nothing is selected, or the page is out of reach. */
    selection: SelectedContent | null;
    /** The tab's own title and address, which a note clip saves. */
    title?: string;
    url?: string;
    /** What the page says about itself, which a note clip saves in its `#pageDescription` label. */
    description?: string;
}

/**
 * What the card saves: the selection, the readable page (`clipType: "page"`), or a note about the
 * page with a link to it (`clipType: "note"`), which the popup calls a bookmark.
 */
type ClipMode = "selection" | "page" | "note";

/** What the user has chosen and typed in the card, kept by `Popup` so a reconnection does not lose it. */
interface Draft {
    mode?: ClipMode;
    /** `undefined` until the user edits the title. */
    title?: string;
    /** `undefined` until the user edits the page's description. */
    description?: string;
    text: string;
}

/** The code styles of the share theme, `packages/share-theme/src/content/content.css`. */
const PREVIEW_STYLE = `
    @font-face { font-family: JetBrainsLight; src: url("${monospaceFontUrl}") format("woff2"); }
    :root {
        color-scheme: light dark;
        --code-block-box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.1), 0px 0px 2px rgba(0, 0, 0, 0.2);
    }
    @media (prefers-color-scheme: dark) {
        :root { --code-block-box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.6); }
    }
    html { overflow: hidden; }
    body { margin: 8px; font: 12px/1.5 system-ui, sans-serif; overflow-wrap: anywhere; }
    h1 { font-size: 1.3em; } h2 { font-size: 1.15em; } h3, h4, h5, h6 { font-size: 1em; }
    img, video, svg { max-width: 100%; height: auto; }
    pre, code, kbd, samp { font-family: JetBrainsLight, ui-monospace, monospace; }
    code:not(pre code) {
        padding: 0.1em 0.35em; border-radius: 5px; font-size: 0.8em; overflow-wrap: break-word;
        background-color: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.08));
    }
    pre {
        margin-top: 2px; padding: 0.6em 0.75em; border-radius: 6px;
        box-shadow: var(--code-block-box-shadow);
        background-color: light-dark(#f3f3f3, #1f1f1f); color: light-dark(#000000, #cccccc);
        white-space: pre; tab-size: 4; text-align: left; direction: ltr;
    }
    pre:has(> code) { padding: 0; }
    pre code { display: block; padding: 0.6em 0.75em; overflow: auto; }
    a { color: light-dark(#0076af, #95c3d9); text-decoration: none; }
    .embed-chip {
        display: inline-flex; align-items: center; gap: 6px; margin: 4px 0; padding: 2px 10px 2px 8px;
        border-radius: 999px; white-space: nowrap;
        background: light-dark(#0000000f, #ffffff28); color: light-dark(#000000ad, #ffffffc2);
    }
    .embed-chip svg { width: 16px; height: 16px; flex-shrink: 0; }
    .embed-chip-detail { color: light-dark(#666, #bbb); }
`;

const MODE_LABELS: Record<ClipMode, string> = { selection: "Selection", page: "Page", note: "Bookmark" };

/** The save button of each mode, with the command whose shortcut it shows, or its own shortcut. */
const SAVE_BUTTONS: Record<ClipMode, { icon: IconDefinition, label: string, command: string, shortcut?: string }> = {
    selection: { icon: Highlight, label: "Save selection", command: "saveSelection" },
    page: { icon: Article, label: "Save page to Trilium", command: "saveWholePage" },
    note: { icon: Bookmark, label: "Save bookmark", command: "", shortcut: "Ctrl+Enter" }
};

const root = document.getElementById("root");
if (root) {
    render(<Popup />, root);
}

export function Popup() {
    const [ searchStatus, setSearchStatus ] = useState<TriliumSearchStatus>();
    const [ clippedNoteId, setClippedNoteId ] = useState<string | null>(null);
    const [ shortcuts, setShortcuts ] = useState<Shortcuts>({});
    const [ draft, setDraft ] = useState<Draft>({ text: "" });

    useEffect(() => {
        function onMessage(message: PopupMessage) {
            if (message.name === "trilium-search-status") {
                setSearchStatus(message.triliumSearch);

                if (message.triliumSearch && isConnected(message.triliumSearch)) {
                    void sendMessage({ name: "trigger-trilium-search-note-url" });
                }
            } else if (message.name === "trilium-previously-visited") {
                const { searchNote } = message;
                setClippedNoteId(searchNote.status === "found" ? searchNote.noteId : null);
            }
        }

        browser.runtime.onMessage.addListener(onMessage);
        void sendMessage({ name: "send-trilium-search-status" });
        void browser.commands.getAll().then((commands) => setShortcuts(shortcutsByCommand(commands)));

        return () => browser.runtime.onMessage.removeListener(onMessage);
    }, []);

    const status = describeStatus(searchStatus);
    const isMismatch = searchStatus?.status === "version-mismatch";

    let body: ComponentChildren;
    if (searchStatus?.status === "not-found") {
        body = <TriliumNotFound />;
    } else {
        body = (
            <CaptureActions
                disabled={!!searchStatus && !isConnected(searchStatus)}
                shortcuts={shortcuts}
                draft={draft}
                onDraftChange={setDraft}
            />
        );
    }

    return (
        <div className="popup">
            {(clippedNoteId || isMismatch) && (
                <div className="notices">
                    {clippedNoteId && (
                        <div className="callout callout-info already-visited">
                            <span>Web page already clipped.</span>
                            <a
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    void sendMessage({ name: "openNoteInTrilium", noteId: clippedNoteId });
                                }}
                            >Open in Trilium</a>
                        </div>
                    )}
                    {searchStatus?.status === "version-mismatch" && (
                        <div className="callout callout-warning">
                            Trilium instance found, but it is not compatible with this extension version.
                            Please update {searchStatus.extensionMajor > searchStatus.triliumMajor ? "Trilium Notes" : "this extension"} to
                            the latest version.
                        </div>
                    )}
                </div>
            )}

            {body}

            <div className="connection">
                <span className={`status-${status.kind}`} title={status.title}>
                    <span className={`status-dot status-dot-${status.kind}`} />
                    {status.text}
                </span>

                <button
                    className="icon-action refresh"
                    title="Check the connection again"
                    aria-label="Check the connection again"
                    onClick={() => sendMessage({ name: "trigger-trilium-search" })}
                >
                    <Icon icon={RefreshCw} />
                </button>

                <button className="icon-action" title="Options" aria-label="Options" onClick={() => browser.runtime.openOptionsPage()}>
                    <Icon icon={Cog} />
                </button>
                <button className="icon-action" title="Help" aria-label="Help" onClick={() => window.open(HELP_URL, "_blank")}>
                    <Icon icon={HelpCircle} />
                </button>
            </div>
        </div>
    );
}

function CaptureActions({ disabled, shortcuts, draft, onDraftChange }: {
    disabled: boolean;
    shortcuts: Shortcuts;
    draft: Draft;
    onDraftChange: (draft: Draft) => void;
}) {
    /** `undefined` while the page is read. */
    const [ tab, setTab ] = useState<TabContent>();

    useEffect(() => {
        void readActiveTab().then(setTab);
    }, []);

    function sendAndClose(name: string) {
        void sendMessage({ name });
        window.close();
    }

    const disabledReason = disabled ? DISCONNECTED_TITLE : undefined;
    const pageDisabledReason = disabledReason ?? (tab?.page === "inaccessible" ? UNREACHABLE_TITLE : undefined);

    let main: ComponentChildren;
    if (tab?.page === "inaccessible") {
        main = (
            <EmptyState icon={Lock}>
                {"The extension cannot access this page.\nIf it is a regular web page, reload it."}
            </EmptyState>
        );
    } else {
        main = <PagePreview tab={tab} disabled={disabled} shortcuts={shortcuts} draft={draft} onDraftChange={onDraftChange} />;
    }

    return (
        <div className="capture-actions">
            {main}

            <div className="toolbar">
                <ToolbarAction
                    icon={Crop} label="Crop" name="Crop screenshot"
                    shortcut={shortcuts.saveCroppedScreenshot} disabledReason={pageDisabledReason}
                    onClick={() => sendAndClose("save-cropped-screenshot")}
                />
                <ToolbarAction
                    icon={Screenshot} label="Screenshot" name="Visible area screenshot"
                    disabledReason={pageDisabledReason}
                    onClick={() => sendAndClose("save-whole-screenshot")}
                />
                <ToolbarAction
                    icon={Tabs} label="Tabs" name="All tabs in window"
                    shortcut={shortcuts.saveTabs} disabledReason={disabledReason}
                    onClick={() => sendMessage({ name: "save-tabs" })}
                />
            </div>
        </div>
    );
}

/** A secondary action: an icon over a short label, its full name and shortcut in the tooltip. */
function ToolbarAction({ icon, label, name, shortcut, disabledReason, onClick }: {
    icon: IconDefinition;
    label: string;
    name: string;
    shortcut?: string;
    /** Why the action is disabled, shown in place of its name; the action is enabled without one. */
    disabledReason: string | undefined;
    onClick: () => void;
}) {
    const title = disabledReason ?? (shortcut ? `${name} (${shortcut})` : name);

    return (
        <button className="toolbar-action" disabled={!!disabledReason} title={title} aria-label={name} onClick={onClick}>
            <Icon icon={icon} />
            <span className="action-label">{label}</span>
        </button>
    );
}

/** Takes the place of the page preview when the page cannot be saved, in the style of the app's `NoItems`. */
function EmptyState({ icon, className, children }: {
    icon: IconDefinition;
    className?: string;
    children: ComponentChildren;
}) {
    return (
        <div className={className ? `no-items ${className}` : "no-items"}>
            <Icon icon={icon} />
            {children}
        </div>
    );
}

/**
 * What the popup saves from the page, with its title editable, and the button that saves it: the
 * selection, the readable page, or a note about the page, with a switch between those the
 * page offers. The page's HTML comes from an arbitrary website, so it is shown only in a sandboxed
 * frame.
 */
function PagePreview({ tab, disabled, shortcuts, draft, onDraftChange }: {
    /** `undefined` while the page is read. */
    tab: TabContent | undefined;
    disabled: boolean;
    shortcuts: Shortcuts;
    draft: Draft;
    onDraftChange: (draft: Draft) => void;
}) {
    const { mode: chosenMode, title, description, text } = draft;
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    const article = typeof tab?.page === "object" ? tab.page : undefined;
    const selection = tab?.selection ?? undefined;
    const modes = tab ? availableModes(article, selection) : [];
    const mode = chosenMode && modes.includes(chosenMode) ? chosenMode : modes[0];
    const clip = mode === "selection" ? selection : mode === "page" ? article : undefined;
    const shownTitle = title ?? (article ?? selection)?.title ?? tab?.title ?? "";
    const shownDescription = description ?? tab?.description ?? "";
    const savedDescription = shownDescription.replace(/\s+/g, " ").trim();

    useEffect(() => {
        if (mode === "note") textAreaRef.current?.focus();
    }, [ mode ]);

    /** Keeps the popup open when the note could not be saved, so its text is not lost. */
    async function saveNote() {
        const content = text.trim();
        const result = await sendMessage({
            name: "save-link-with-note",
            title: shownTitle.trim(),
            content: content ? textToHtml(content) : "",
            ...(savedDescription && { description: savedDescription })
        });
        if (result) window.close();
    }

    function saveClip(content: SelectedContent) {
        const labels = withDescription(content.labels, savedDescription);
        const titled = { ...content, title: shownTitle.trim() || content.title, ...(labels && { labels }) };
        void sendMessage(mode === "selection"
            ? { name: "save-selection", selection: titled }
            : { name: "save-whole-page", page: titled });
        window.close();
    }

    function saveNoteOnCtrlEnter(e: KeyboardEvent) {
        if (mode === "note" && e.key === "Enter" && e.ctrlKey) {
            e.preventDefault();
            void saveNote();
        }
    }

    let onSave: (() => void) | undefined;
    if (mode === "note") {
        onSave = () => void saveNote();
    } else if (clip) {
        onSave = () => saveClip(clip);
    }

    const pageUrl = mode === "note" ? tab?.url : clip?.pageUrl;
    const published = mode === "page" ? article?.labels.publishedDate : undefined;
    const button = SAVE_BUTTONS[mode ?? "page"];

    return (
        <div className="page-preview">
            {mode && (
                <div className="page-heading">
                    <span className="page-icon"><Icon icon={Globe} /></span>
                    <div className="page-heading-text">
                        <input
                            type="text"
                            className="page-title"
                            aria-label="Note title"
                            placeholder="Note title"
                            value={shownTitle}
                            onInput={(e) => onDraftChange({ ...draft, title: e.currentTarget.value })}
                            onKeyDown={saveNoteOnCtrlEnter}
                        />
                        {pageUrl && (
                            <div className="page-meta">
                                {new URL(pageUrl).hostname}{published && ` · Published ${published}`}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {modes.length > 1 && (
                <div className="clip-mode" role="group" aria-label="What to save">
                    {modes.map((option) => (
                        <button key={option} aria-pressed={option === mode} onClick={() => onDraftChange({ ...draft, mode: option })}>
                            {MODE_LABELS[option]}
                        </button>
                    ))}
                </div>
            )}

            {mode === "note" && modes.length === 1 && (
                <div className="clip-hint">This page has no article; save it as a bookmark.</div>
            )}

            <div className="page-body">
                {mode && (
                    <div className="page-description-row">
                        <span
                            className="page-description-icon"
                            title="The page's description. It is saved in the #pageDescription label of the note."
                        >
                            <Icon icon={AlignLeft} />
                        </span>
                        <textarea
                            className="page-description"
                            aria-label="Page description"
                            placeholder="Add a description"
                            rows={2}
                            value={shownDescription}
                            onInput={(e) => onDraftChange({ ...draft, description: e.currentTarget.value })}
                            onKeyDown={saveNoteOnCtrlEnter}
                        />
                    </div>
                )}
                {mode === "note" && (
                    <textarea
                        ref={textAreaRef}
                        className="note-text"
                        value={text}
                        placeholder="Add a note about this page"
                        onInput={(e) => onDraftChange({ ...draft, text: e.currentTarget.value })}
                        onKeyDown={saveNoteOnCtrlEnter}
                    />
                )}
                {clip && (
                    <iframe
                        className="page-content"
                        title="Preview of the page"
                        sandbox="allow-same-origin"
                        srcDoc={previewDocument(clip)}
                        onLoad={(e) => fitToContent(e.currentTarget)}
                    />
                )}
                {!mode && <div className="page-preview-placeholder">Reading the page…</div>}
            </div>

            <button
                className="btn btn-primary primary-action"
                disabled={disabled || !mode}
                title={disabled ? DISCONNECTED_TITLE : undefined}
                onClick={onSave}
            >
                <Icon icon={button.icon} />
                <span className="action-label">{button.label}</span>
                <Shortcut keys={button.shortcut ?? shortcuts[button.command]} />
            </button>
        </div>
    );
}

/** A clip's labels with `#pageDescription` as the user left it, or without one when it is empty. */
function withDescription(labels: Record<string, string> | undefined, description: string) {
    const { pageDescription: _, ...others } = labels ?? {};
    return description ? { ...others, pageDescription: description } : labels && others;
}

/**
 * Keeps the preview as tall as the page it shows, so that the page scrolls in `.page-body` together
 * with the description above it. The page grows after `load` when it rewraps beside the scrollbar of
 * `.page-body` or a lazy image loads, so a `ResizeObserver` from the frame's own window refits it.
 * `allow-same-origin` lets the popup read the height, and gives the frame the extension's origin.
 * The sandbox must not get `allow-scripts` too: with both, the clipped page's HTML runs as the
 * extension, with its browser APIs.
 */
function fitToContent(frame: HTMLIFrameElement) {
    const root = frame.contentDocument?.documentElement;
    const view = frame.contentWindow as (Window & typeof globalThis) | null;
    if (!root || !view) return;
    new view.ResizeObserver(() => {
        frame.style.height = `${Math.ceil(root.getBoundingClientRect().height)}px`;
    }).observe(root);
}

/** The modes the page offers, the default first: the selection, then the article, then a note. */
function availableModes(article: ReadablePage | undefined, selection: SelectedContent | undefined): ClipMode[] {
    const modes: ClipMode[] = [];
    if (selection) modes.push("selection");
    if (article) modes.push("page");
    modes.push("note");
    return modes;
}

/**
 * A shortcut as the app draws it: a key cap per key, joined by "+". The browser formats the shortcut;
 * on macOS, Chrome gives the glyphs without a "+" (`⌥⇧S`), which stay in one key cap there too.
 */
function Shortcut({ keys }: { keys: string | undefined }) {
    if (!keys) return null;

    return (
        <span className="shortcut">
            {keys.split("+").map((key, index) => (
                <Fragment key={index}>{index > 0 && "+"}<kbd>{key}</kbd></Fragment>
            ))}
        </span>
    );
}

function TriliumNotFound() {
    return (
        <EmptyState icon={Unlink} className="not-found">
            <h4>Trilium was not found</h4>
            <p>Start the desktop app, or connect to a server in the options.</p>

            <div className="not-found-buttons">
                <button className="btn btn-primary" onClick={() => sendMessage({ name: "trigger-trilium-search" })}>
                    <Icon icon={RefreshCw} />Retry
                </button>
                <button className="btn btn-secondary" onClick={() => browser.runtime.openOptionsPage()}>
                    <Icon icon={Cog} />Open options
                </button>
            </div>
        </EmptyState>
    );
}

/** The state of the connection to Trilium: a kind for its color, and its description. */
function describeStatus(status: TriliumSearchStatus | undefined) {
    switch (status?.status) {
        case undefined:
        case "searching":
            return { kind: "pending", text: "Looking for Trilium…" };
        case "not-found":
            return { kind: "error", text: "Not found" };
        case "version-mismatch":
            return { kind: "warning", text: "Incompatible version" };
        case "found-desktop":
            return { kind: "ok", text: "Connected to the desktop app", title: `Connected to port ${status.port}` };
        case "found-server":
            return { kind: "ok", text: "Connected to the server", title: `Connected to ${status.url}` };
    }
}

/** Asks the content script of the active tab for its readable page and its selection, together. */
async function readActiveTab(): Promise<TabContent> {
    const [ tab ] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return { page: "inaccessible", selection: null };

    const [ page, selection, description ] = await Promise.all([
        extractPage(tab.id), readSelection(tab.id), readDescription(tab.id)
    ]);
    return { page, selection, title: tab.title, url: tab.url, description };
}

/**
 * `extractReadablePage()` answers `undefined` when Readability cannot parse the page, and fails
 * where the extension cannot run scripts.
 */
async function extractPage(tabId: number): Promise<PageState> {
    try {
        return await extractReadablePage(tabId) ?? "unreadable";
    } catch {
        return "inaccessible";
    }
}

/**
 * The selection on the page, or `null` when there is none. A click on the page leaves a collapsed
 * selection, which the content script still answers with, empty.
 */
async function readSelection(tabId: number): Promise<SelectedContent | null> {
    try {
        const selection: SelectedContent | undefined = await browser.tabs.sendMessage(tabId, { name: "trilium-save-selection" });
        if (!selection) return null;

        const text = new DOMParser().parseFromString(selection.content, "text/html").body.textContent;
        return text.trim() || selection.images.length ? selection : null;
    } catch {
        return null;
    }
}

/**
 * The page's description, or `undefined` when it has none. A content script from before an update
 * answers nothing, and none runs on the browser's own pages.
 */
async function readDescription(tabId: number): Promise<string | undefined> {
    try {
        const metadata: { description?: string } | undefined =
            await browser.tabs.sendMessage(tabId, { name: "trilium-get-page-metadata" });
        return metadata?.description;
    } catch {
        return undefined;
    }
}

/** A standalone document showing the page's content, its images loaded from the website. */
export function previewDocument({ content, images }: Pick<ReadablePage, "content" | "images">) {
    const doc = new DOMParser().parseFromString(content, "text/html");
    for (const img of doc.querySelectorAll("img")) {
        const image = images.find(({ imageId }) => imageId === img.getAttribute("src"));
        if (image) {
            img.setAttribute("src", image.src);
        }
    }
    // The sandbox still lets the frame navigate itself: through a link, which the keyboard
    // can follow, or through a `<meta http-equiv="refresh">`.
    for (const link of doc.querySelectorAll("a[href], area[href]")) {
        link.removeAttribute("href");
    }
    for (const meta of doc.querySelectorAll("meta[http-equiv]")) {
        meta.remove();
    }
    // Trilium saves a YouTube player as a link preview and drops every other iframe.
    for (const frame of doc.querySelectorAll("iframe")) {
        const videoId = extractYouTubeVideoId(frame.getAttribute("src") ?? "");
        if (videoId) {
            frame.replaceWith(youTubeChip(doc, videoId));
        } else {
            frame.remove();
        }
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${PREVIEW_STYLE}</style></head>`
        + `<body>${doc.body.innerHTML}</body></html>`;
}

/** Stands in for an embedded YouTube player, which the sandboxed preview cannot run. */
function youTubeChip(doc: Document, videoId: string) {
    const { viewBox, content } = iconVariant(Youtube, "brands");
    const chip = doc.createElement("span");
    chip.className = "embed-chip";
    chip.innerHTML = `<svg viewBox="${viewBox}" fill="currentColor" aria-hidden="true">${content}</svg>`
        + `<span>YouTube video</span><span class="embed-chip-detail">youtu.be/${videoId}</span>`;
    return chip;
}

/** Matches the same URLs as `YOUTUBE_REGEX` in `packages/commons/src/lib/link_embed.ts`. */
function extractYouTubeVideoId(url: string) {
    const match = url.match(/(?:youtube\.com\/watch\?[^\s#]*v=|youtu\.be\/|youtube(?:-nocookie)?\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    return match?.[1];
}

/** Maps each bound command to its shortcut, as the browser shows it. */
export function shortcutsByCommand(commands: { name?: string, shortcut?: string }[]): Shortcuts {
    const shortcuts: Shortcuts = {};
    for (const { name, shortcut } of commands) {
        if (name && shortcut) {
            shortcuts[name] = shortcut;
        }
    }
    return shortcuts;
}

/** A Boxicons v3 icon, drawn inline in the current text color. */
function Icon({ icon }: { icon: IconDefinition }) {
    const { viewBox, content } = iconVariant(icon);
    return (
        <svg
            className="icon"
            viewBox={viewBox}
            fill="currentColor"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: content }}
        />
    );
}

/** A variant of an icon, by default the outlined one, which matches the app's Boxicons. */
export function iconVariant(icon: IconDefinition, pack: IconPack = "basic"): IconData {
    const data = icon.packs[pack];
    if (!data) {
        throw new Error(`Boxicons has no ${pack} variant of '${icon.name}'.`);
    }
    return data;
}

/** A version mismatch counts as connected, so the buttons stay enabled and report it on use. */
function isConnected(status: TriliumSearchStatus) {
    return status.status === "found-desktop" || status.status === "found-server" || status.status === "version-mismatch";
}

async function sendMessage(message: object) {
    try {
        console.log("Sending message", message);
        return await browser.runtime.sendMessage(message);
    } catch (e) {
        console.log("Calling browser runtime failed:", e);
        alert("Calling browser runtime failed. Refreshing page might help.");
    }
}

/** Escapes plain text as HTML, with one paragraph per line. */
export function textToHtml(text: string) {
    const escaped = text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

    return `<p>${escaped.replaceAll("\n", "</p><p>")}</p>`;
}
