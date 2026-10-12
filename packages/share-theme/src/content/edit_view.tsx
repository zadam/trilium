import "@triliumnext/client/src/stylesheets/ckeditor-theme.css";
import "@triliumnext/client/src/widgets/type_widgets/text/EditableText.css";

import appContext from "@triliumnext/client/src/components/app_context.js";
import Component from "@triliumnext/client/src/components/component.js";
import type { SaveState } from "@triliumnext/client/src/components/note_context.js";
import froca from "@triliumnext/client/src/services/froca.js";
import { t } from "@triliumnext/client/src/services/i18n.js";
import linkService from "@triliumnext/client/src/services/link.js";
import server from "@triliumnext/client/src/services/server.js";
import utils, { randomString, type ShareEditGlobals } from "@triliumnext/client/src/services/utils.js";
import { TYPE_MAPPINGS } from "@triliumnext/client/src/widgets/note_types.js";
import Alert from "@triliumnext/client/src/widgets/react/Alert.js";
import Button from "@triliumnext/client/src/widgets/react/Button.js";
import { useTriliumEvent } from "@triliumnext/client/src/widgets/react/hooks.js";
import { type ComponentType, createPortal, render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import ShareAppHost, { type AppPayload, type HostedApp } from "./app_host.js";

export interface EditViewOptions {
    noteId: string;
    /** The page's title element, which the view makes editable. */
    title: HTMLElement;
    payload: AppPayload;
    csrfToken: string;
    /** The `blobId` of the note's content, which the first save names. */
    version: string;
    attachments: boolean;
    /** Where the page shows the editor's state; above the editor without one. */
    statusContainer?: HTMLElement;
    /** Where the page shows the editor's toolbar; above the editor without one. */
    toolbarContainer?: HTMLElement;
}

export interface EditView {
    /** Saves what the editor and the title still hold. */
    stop(): Promise<void>;
}

/** What the app's modules read from `window.glob` on a page that saves, beyond the boot script's. */
interface EditGlobals {
    baseApiUrl: string;
    csrfToken: string;
    csrfRefreshUrl: string;
    componentId: string;
    isDesktop: typeof utils.isDesktop;
    isMobile: typeof utils.isMobile;
    getHeaders: typeof server.getHeaders;
    getComponentByEl: typeof appContext.getComponentByEl;
    getReferenceLinkTitle: (href: string) => Promise<string>;
    getReferenceLinkTitleSync: (href: string, storedTitle?: string) => string;
    getActiveContextNote: () => HostedApp["note"] | null;
    froca: typeof froca;
    treeCache: typeof froca;
    shareEdit: ShareEditGlobals;
}

export type { ShareEditGlobals };

/** How long after the last keystroke the title is saved. */
const TITLE_SAVE_DELAY = 1000;

/**
 * Mounts the app's text editor on a shared page whose note the visitor unlocked: the editor saves
 * through the share's guest API, under the CSRF token the login issued, and the page's title saves
 * the same way. The editor's state and a save the server refused as stale show above it.
 */
export default async function mountEditView(container: HTMLElement, options: EditViewOptions): Promise<EditView> {
    const status = createStatus();
    const component = new Component();
    installGlobals(options, status, component);
    const view = await TYPE_MAPPINGS.editableText.view();
    const Widget = ("default" in view ? view.default : view) as ComponentType<WidgetProps>;
    render(
        <ShareAppHost noteId={options.noteId} payload={options.payload} readOnly={false} component={component}>
            {(app) => (
                <EditShell
                    app={app}
                    Widget={Widget}
                    status={status}
                    component={component}
                    statusContainer={options.statusContainer}
                    toolbarContainer={options.toolbarContainer}
                />
            )}
        </ShareAppHost>,
        container
    );
    const title = makeTitleEditable(options.title, options.noteId, container);

    return {
        async stop() {
            await title.flush();
            await component.triggerCommand("saveNoteDetailNow");
        }
    };
}

/**
 * Sets what the app's modules read on a page that saves: the share's API as the server, the CSRF
 * token and where to refresh it, the globals the editor's plugins call, and the share-editing
 * state `services/utils.ts` tells the editor by. The editor's plugins reach the widget's handlers
 * through the component at an element; the page has no widget element to find, so they get
 * `component`, which the widget registers its handlers on.
 */
function installGlobals(options: EditViewOptions, status: Status, component: Component) {
    // The boot script defines `window.glob` on every shared page.
    const glob = window.glob as unknown as EditGlobals;
    glob.baseApiUrl = "api/";
    glob.csrfToken = options.csrfToken;
    glob.csrfRefreshUrl = `api/edit/session?noteId=${encodeURIComponent(options.noteId)}`;
    glob.componentId = randomString(12);
    glob.isDesktop = utils.isDesktop;
    glob.isMobile = utils.isMobile;
    glob.getHeaders = server.getHeaders;
    glob.getComponentByEl = (el) => appContext.getComponentByEl(el) ?? component;
    glob.getReferenceLinkTitle = (href) => linkService.getReferenceLinkTitle(href);
    glob.getReferenceLinkTitleSync = (href, storedTitle) => linkService.getReferenceLinkTitleSync(href, storedTitle);
    glob.getActiveContextNote = () => froca.getNoteFromCache(options.noteId) ?? null;
    glob.froca = froca;
    glob.treeCache = froca;
    glob.shareEdit = {
        version: options.version,
        attachments: options.attachments,
        onSaveState: (state) => status.report(state),
        onConflict: (stale, retry) => status.set({ state: "error", conflict: { stale, retry } })
    };
}

interface Conflict {
    stale: { blobId: string };
    retry(): void;
}

interface StatusValue {
    state: SaveState;
    conflict?: Conflict;
}

/** The editor's state, which the globals write and {@link EditShell} shows. */
interface Status {
    value: StatusValue;
    set(value: StatusValue): void;
    /** Shows the state the editor reports; a conflict stays up until the visitor settles it. */
    report(state: SaveState): void;
    subscribe(listener: (value: StatusValue) => void): () => void;
}

function createStatus(): Status {
    const listeners = new Set<(value: StatusValue) => void>();
    const status: Status = {
        value: { state: "saved" },
        set(value) {
            status.value = value;
            for (const listener of listeners) {
                listener(value);
            }
        },
        report(state) {
            status.set({ state, conflict: status.value.conflict });
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
    return status;
}

interface WidgetProps {
    note: HostedApp["note"];
    viewScope: undefined;
    ntxId: null;
    parentComponent: Component;
    noteContext: undefined;
    isVisible: boolean;
}

interface EditShellProps {
    app: HostedApp;
    Widget: ComponentType<WidgetProps>;
    status: Status;
    /** The component the editor reports to, which the page's commands reach it through. */
    component: Component;
    statusContainer?: HTMLElement;
    toolbarContainer?: HTMLElement;
}

/**
 * The editor's toolbar, state and conflict above the app's editor of the note. The classic
 * editor is decoupled: its toolbar is an element the host places, as the app's formatting
 * toolbar does when the editor reports itself.
 */
function EditShell(
    { app, Widget, status, component, statusContainer, toolbarContainer }: EditShellProps
) {
    const [ value, setValue ] = useState(status.value);
    const { conflict } = value;
    const toolbarRef = useRef<HTMLDivElement>(null);
    useEffect(() => status.subscribe(setValue), [ status ]);
    useTriliumEvent("textEditorRefreshed", ({ editor }) => {
        const toolbar = editor.ui.view.toolbar?.element;
        toolbarRef.current?.replaceChildren(...(toolbar ? [ toolbar ] : []));
    });

    const state = (
        <span className="share-edit-status">{t(`share_edit.status_${value.state}`)}</span>
    );
    const toolbar = <div ref={toolbarRef} className="share-edit-toolbar" />;
    return (
        <>
            {toolbarContainer ? createPortal(toolbar, toolbarContainer) : toolbar}
            {statusContainer ? createPortal(state, statusContainer) : state}
            {conflict && <Alert type="warning" className="share-edit-conflict">
                <p>{t("share_edit.conflict")}</p>
                <Button text={t("share_edit.conflict_reload")} onClick={() => window.location.reload()} />
                <Button
                    text={t("share_edit.conflict_keep")}
                    kind="primary"
                    onClick={() => {
                        status.set({ state: "unsaved" });
                        conflict.retry();
                    }}
                />
            </Alert>}
            <div className={TYPE_MAPPINGS.editableText.className}>
                <Widget
                    note={app.note}
                    viewScope={undefined}
                    ntxId={null}
                    parentComponent={component}
                    noteContext={undefined}
                    isVisible
                />
            </div>
        </>
    );
}

/**
 * Makes the page's title editable the way the app's title box is: typing saves it once the
 * visitor pauses, Enter moves into the content, and leaving the title saves it at once.
 */
function makeTitleEditable(title: HTMLElement, noteId: string, container: HTMLElement) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // An element's `textContent` is a string, whatever the DOM types allow.
    const readTitle = () => String(title.textContent).trim();
    let saved = readTitle();
    const save = async () => {
        clearTimeout(timer);
        timer = undefined;
        const text = readTitle();
        if (text && text !== saved) {
            saved = text;
            await server.put(`notes/${noteId}/title`, { title: text });
        }
    };

    title.contentEditable = "true";
    title.spellcheck = true;
    title.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => void save(), TITLE_SAVE_DELAY);
    });
    title.addEventListener("keydown", (event) => {
        // An Enter that confirms an input method's composition belongs to the composition.
        if (event.key === "Enter" && !event.isComposing) {
            event.preventDefault();
            container.querySelector<HTMLElement>(".ck-editor__editable")?.focus();
        }
    });
    title.addEventListener("blur", () => void save());

    return { flush: save };
}
