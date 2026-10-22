/**
 * Public type surface for Trilium **user scripts** — the shape of the `api`
 * global available inside frontend/backend script notes.
 *
 * This is the single source of truth for script API types, consumed by:
 *  - the in-editor TypeScript language service (bundled into the script-note vfs),
 *  - the `script-deployer` app (script authoring/typechecking),
 * and kept honest against the real implementations by member-presence drift
 * guards (see `frontend_script_api.ts` / `backend_script_api.ts`).
 *
 * It is intentionally **self-contained** (no imports): the real `Api` interfaces
 * drag in the whole client/server graph (froca, widgets, jQuery, Vite `?raw`
 * imports) which can't be resolved by a browser-based language service. These
 * are faithful, decoupled re-declarations of the public surface — heavy or
 * advanced members (widget base classes, editor instances, the Preact API) are
 * typed as `unknown` rather than pulling in their real types.
 */

/** A label or relation attached to a note. */
/** One thing a picker offers, as `pickSingleItem` takes and answers with. */
export interface PickerItem {
    key: string;
    caption: string;
    /** An icon class, `bx` prefix included. */
    icon?: string;
    /** HTML shown in a tooltip while the item is hovered. */
    tooltip?: string;
}

/** A run of picker items under a heading of their own. */
export interface PickerItemGroup {
    key: string;
    groupHeader: string;
    items: PickerItem[];
}

export interface ScriptAttribute {
    attributeId: string;
    type: "label" | "relation";
    name: string;
    value: string;
    isInheritable: boolean;
    isOwned: boolean;
}

/** An attachment as seen by frontend scripts (subset of the client's `FAttachment`). */
export interface ScriptAttachment {
    attachmentId: string;
    ownerId: string;
    role: string;
    mime: string;
    title: string;
    utcDateModified: string;
    contentLength: number;
}

/** Creation/modification timestamps returned by {@link ScriptFNote.getMetadata}. */
export interface ScriptNoteMetadata {
    dateCreated: string;
    utcDateCreated: string;
    dateModified: string;
    utcDateModified: string;
}

/** A note's binary/text content blob (subset of the client's `FBlob`). */
export interface ScriptBlob {
    blobId: string;
    content: string;
    contentLength: number;
    dateModified: string;
    utcDateModified: string;
}

/** One resolved tree path to a note (subset of the client's `NotePathRecord`). */
export interface ScriptNotePathRecord {
    isArchived: boolean;
    isInHoistedSubTree: boolean;
    isSearch?: boolean;
    notePath: string[];
    isHidden: boolean;
}

/** A note as seen by frontend scripts (subset of the client's `FNote`). */
export interface ScriptFNote {
    noteId: string;
    title: string;
    type: string;
    mime: string;
    isProtected: boolean;
    /** Whether the note is archived (has the `archived` label). */
    isArchived: boolean;
    /** Whether the note's metadata (title, attributes) is read-only. */
    isMetadataReadOnly: boolean;
    /** IDs of this note's owned attributes. */
    attributes: string[];
    /** IDs of relations pointing *at* this note. */
    targetRelations: string[];
    /** Parent note IDs. */
    parents: string[];
    /** Child note IDs. */
    children: string[];

    // --- Hierarchy ---------------------------------------------------------
    getParentNotes(): ScriptFNote[];
    getChildNotes(): Promise<ScriptFNote[]>;
    getParentNoteIds(): string[];
    getChildNoteIds(): string[];
    getChildNoteIdsWithArchiveFiltering(includeArchived?: boolean): Promise<string[]>;
    getSubtreeNotes(): Promise<ScriptFNote[]>;
    getSubtreeNoteIds(includeArchived?: boolean): Promise<string[]>;
    hasChildren(): boolean;
    hasAncestor(ancestorNoteId: string, followTemplates?: boolean): boolean;
    isRoot(): boolean;
    getParentBranchIds(): string[];
    getBranchIds(): string[];
    getParentBranches(): ScriptFBranch[];
    getChildBranches(): ScriptFBranch[];
    getBranches(): ScriptFBranch[];
    getFilteredChildBranches(): ScriptFBranch[];
    getAllNotePaths(): string[][];
    getBestNotePath(hoistedNoteId?: string, activeNotePath?: string | null): string[];
    getBestNotePathString(hoistedNoteId?: string): string;
    getSortedNotePathRecords(
        hoistedNoteId?: string,
        activeNotePath?: string | null
    ): ScriptNotePathRecord[];

    // --- Attributes (inherited + own) --------------------------------------
    getAttributes(type?: string, name?: string): ScriptAttribute[];
    getOwnedAttributes(type?: string, name?: string): ScriptAttribute[];
    getAttribute(type: string, name: string): ScriptAttribute | null;
    getOwnedAttribute(type: string, name: string): ScriptAttribute | null;
    getAttributeValue(type: string, name: string): string | null;
    getOwnedAttributeValue(type: string, name: string): string | null;
    hasAttribute(type: string, name: string): boolean;
    hasOwnedAttribute(type: string, name: string): boolean;
    getAttributeDefinitions(): ScriptAttribute[];
    getPromotedDefinitionAttributes(): ScriptAttribute[];

    // --- Labels ------------------------------------------------------------
    getLabels(name?: string): ScriptAttribute[];
    getOwnedLabels(name?: string): ScriptAttribute[];
    getLabel(name: string): ScriptAttribute | null;
    getOwnedLabel(name: string): ScriptAttribute | null;
    getLabelValue(name: string): string | null;
    getOwnedLabelValue(name: string): string | null;
    hasLabel(name: string): boolean;
    hasOwnedLabel(name: string): boolean;
    hasLabelOrDisabled(name: string): boolean;
    isLabelTruthy(name: string): boolean;

    // --- Relations ---------------------------------------------------------
    getRelations(name?: string): ScriptAttribute[];
    getOwnedRelations(name: string): ScriptAttribute[];
    getRelation(name: string): ScriptAttribute | null;
    getOwnedRelation(name: string): ScriptAttribute | null;
    getRelationValue(name: string): string | null;
    getOwnedRelationValue(name: string): string | null;
    hasRelation(name: string): boolean;
    hasOwnedRelation(name: string): boolean;
    getLabelOrRelation(nameWithPrefix: string): string | null;
    getRelationTarget(name: string): Promise<ScriptFNote | null>;
    getRelationTargets(name: string): Promise<(ScriptFNote | null)[]>;
    getTargetRelations(): ScriptAttribute[];
    getTargetRelationSourceNotes(): Promise<ScriptFNote[]>;

    // --- Content & attachments ---------------------------------------------
    getContent(): Promise<string | Uint8Array>;
    getJsonContent(): Promise<unknown>;
    getBlob(): Promise<ScriptBlob | null>;
    getNoteComplement(): Promise<ScriptBlob | null>;
    getMetadata(): Promise<ScriptNoteMetadata>;
    attachments: ScriptAttachment[] | null;
    getAttachments(): Promise<ScriptAttachment[]>;
    getAttachmentsByRole(role: string): Promise<ScriptAttachment[]>;
    getAttachmentById(attachmentId: string): Promise<ScriptAttachment | undefined>;
    getNotesToInheritAttributesFrom(): ScriptFNote[];

    // --- Type & state predicates -------------------------------------------
    getIcon(): string;
    isFolder(): boolean;
    isShared(): boolean;
    isContentAvailable(): boolean;
    isJson(): boolean;
    isJavaScript(): boolean;
    isJsx(): boolean;
    isHtml(): boolean;
    isMarkdown(): boolean;
    isOptions(): boolean;
    isTriliumScript(): boolean;
    isTriliumSqlite(): boolean;
    isLaunchBarConfig(): boolean;
    isHiddenCompletely(): boolean;
    isInHiddenSubtree(): boolean;
    isEligibleForConversionToAttachment(): boolean;

    // --- Presentation ------------------------------------------------------
    getColorClass(): string;
    getCssClass(): string;
    getWorkspaceIconClass(): string;
    getWorkspaceTabBackgroundColor(): string;

    // --- Scripting runtime -------------------------------------------------
    getScriptEnv(): "frontend" | "backend" | null;
    executeScript(): Promise<unknown>;

    // --- Low-level / Froca-managed -----------------------------------------
    // Exposed for completeness; most scripts should use the higher-level
    // accessors above rather than these cache fields and mutators.
    /** Blob ID of the current content; changes when content changes. */
    blobId: string;
    /** Map of parent note ID → branch ID. */
    parentToBranch: Record<string, string>;
    /** Map of child note ID → branch ID. */
    childToBranch: Record<string, string>;
    searchResultsLoaded?: boolean;
    highlightedTokens?: string[];
    /** Plain data representation of the note (the live object minus its cache handle). */
    dto: Record<string, unknown>;
    addParent(parentNoteId: string, branchId: string, sort?: boolean): void;
    addChild(childNoteId: string, branchId: string, sort?: boolean): void;
    sortParents(): void;
    sortChildren(): void;
    update(row: Record<string, unknown>): void;
    invalidateAttributeCache(): void;
    toString(): string;
}

/** A branch (parent↔child link) as seen by frontend scripts (subset of `FBranch`). */
export interface ScriptFBranch {
    branchId: string;
    noteId: string;
    parentNoteId: string;
    notePosition: number;
    prefix?: string;
    isExpanded?: boolean;
    getNote(): Promise<ScriptFNote | null>;
    getNoteFromCache(): ScriptFNote | undefined;
    getParentNote(): Promise<ScriptFNote | null>;
    isTopLevel(): boolean;
}

/** A split/tab context as seen by frontend scripts (subset of `NoteContext`). */
export interface ScriptNoteContext {
    ntxId: string | null;
    note: ScriptFNote | null;
    notePath: string | null;
    getCodeEditor(): Promise<unknown>;
    getTextEditor(): Promise<unknown>;
}

/** Minimal day.js surface (the real API exposes the full day.js factory). */
export type ScriptDayjs = (date?: string | number | Date) => ScriptDayjsInstance;

/** A date as day.js wraps it (subset). */
export interface ScriptDayjsInstance {
    /**
     * Formats the date, such as `"YYYY-MM-DD"` for `2026-10-22`. Without a template, it returns the
     * ISO 8601 form with the UTC offset, such as `2026-10-22T14:03:05+02:00`.
     */
    format(template?: string): string;
    /**
     * Returns a new date, `value` units later. The date it is called on stays unchanged.
     *
     * @param unit The unit, such as `"day"`, `"week"`, `"month"` or `"year"`.
     */
    add(value: number, unit: string): ScriptDayjsInstance;
    /**
     * Returns a new date, `value` units earlier. The date it is called on stays unchanged.
     *
     * @param unit The unit, such as `"day"`, `"week"`, `"month"` or `"year"`.
     */
    subtract(value: number, unit: string): ScriptDayjsInstance;
    /** Returns the date as a JavaScript `Date`. */
    toDate(): Date;
}

type Func = ((...args: unknown[]) => unknown) | string;

/** Instance shape of `BasicWidget` (subset) — the base for custom frontend widgets. */
interface BasicWidget {
    /**
     * The widget's root jQuery element (assign in `doRender`, e.g. `this.$widget = $(TPL)`).
     * Typed loosely because jQuery types can't be imported into this self-contained module;
     * inside the editor it is a real `JQuery<HTMLElement>` so all jQuery methods work.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $widget: any;
    /** Whether the widget should be shown for the current context. */
    isEnabled(): boolean | null | undefined;
    /** Builds `this.$widget`. Override to render the widget's DOM. */
    doRender(): void;
    /** Renders the widget and returns its root element. */
    render(): unknown;
    /** Tears down the widget; override to release resources. */
    cleanup(): void;
    /** Fluent builder: set the element id. Chainable. */
    id(id: string): this;
    /** Fluent builder: add a CSS class. Chainable. */
    class(className: string): this;
    /** Fluent builder: set an inline CSS property. Chainable. */
    css(name: string, value: string): this;
    /** Fluent builder: append child components. Chainable. */
    child(...components: unknown[]): this;
}

/** Instance shape of `NoteContextAwareWidget` (subset) — reacts to the active note. */
interface NoteContextAwareWidget extends BasicWidget {
    /** The note currently shown in this widget's context. */
    note: ScriptFNote | null;
    /** The note context (split) this widget is attached to. */
    noteContext?: ScriptNoteContext;
    /** Called when the active note changes. Override to update the widget. */
    refreshWithNote(note: ScriptFNote | null | undefined): void | Promise<void>;
    /** Forces a refresh against the current note. */
    refresh(): void | Promise<void>;
}

/** Instance shape of `RightPanelWidget` (subset) — a widget shown in the right sidebar. */
interface RightPanelWidget extends NoteContextAwareWidget {
    /** Title shown in the right-panel header. */
    readonly widgetTitle: string;
    /** Builds the panel body. Override to render the right-panel content. */
    doRenderBody(): void | Promise<void>;
}

/** Constructor type allowing `class X extends api.Widget { … }`. */
type WidgetClass<T> = new (...args: unknown[]) => T;

/** An attribute to create together with a note (see {@link ScriptCreateNoteOpts.attributes}). */
export interface ScriptCreateAttribute {
    type: "label" | "relation";
    name: string;
    value?: string;
    isInheritable?: boolean;
    position?: number;
}

/** Options accepted by {@link FrontendApi.createNote}. */
export interface ScriptCreateNoteOpts {
    /** Title of the new note. */
    title?: string | null;
    /** Content of the new note (HTML for text notes, source for code notes, etc.). */
    content?: string | null;
    /** Note type, e.g. "text" (default), "code", "book". */
    type?: string;
    /** MIME type, e.g. "application/javascript;env=frontend" for a frontend code note. */
    mime?: string;
    /** Note ID of a template to apply to the new note. */
    templateNoteId?: string;
    /** Create the note as protected (only takes effect when a protected session is available). */
    isProtected?: boolean;
    /** Activate (open) the new note after creation. Defaults to `true`. */
    activate?: boolean;
    /** Which part of the activated note to focus. Defaults to "title". */
    focus?: "title" | "content";
    /** Where to place the note relative to the parent/target: "into" (default) or "after". */
    target?: string;
    /** Branch ID used together with `target: "after"`. */
    targetBranchId?: string;
    /** Attributes to set atomically on creation. */
    attributes?: ScriptCreateAttribute[];
}

/**
 * The `api` global available inside **frontend** script notes
 * (`application/javascript;env=frontend`).
 */
export interface FrontendApi {
    /**
     * Container of all the rendered script content
     * */
    $container: unknown;
    /**
     * Note where the script execution started — the entry point of the current script bundle
     * (in C terms, the file containing `main()`). When a script is spread across multiple code
     * notes (descendant code notes loaded as modules via `require()`), every note in the
     * bundle shares the same `startNote`, while {@link currentNote} differs per note.
     * Messages from `api.log()` are grouped under this note.
     */
    startNote: ScriptFNote;
    /**
     * Note containing the source code that is currently executing (in C terms, `__FILE__`).
     * Equal to {@link startNote} unless execution has moved into a descendant module note
     * loaded via `require()`. Don't confuse this with the note open in the UI — use
     * `api.getActiveContextNote()` for that.
     */
    currentNote: ScriptFNote;
    /**
     * Entity whose event triggered this execution, or `null`.
     *
     * Most frontend scripts are started by the user or by the UI (startup scripts, widgets),
     * so this is usually `null`. It is set to a note when:
     * - the script runs through a `~renderNote` relation — then it's the note being rendered
     *   (the one carrying the relation), not the script note;
     * - a backend script calls `api.runOnFrontend()` — then it's the backend execution's
     *   `originEntity`, provided that entity was a note.
     */
    originEntity: unknown | null;
    /**
     * day.js library for date manipulation.
     * See {@link https://day.js.org} for documentation
     * @see https://day.js.org
     */
    dayjs: ScriptDayjs;

    /** Base class for right-panel widgets — `class X extends api.RightPanelWidget { … }`. */
    RightPanelWidget: WidgetClass<RightPanelWidget>;
    /** Base class for note-context-aware widgets — `class X extends api.NoteContextAwareWidget { … }`. */
    NoteContextAwareWidget: WidgetClass<NoteContextAwareWidget>;
    /** Base class for basic widgets — `class X extends api.BasicWidget { … }`. */
    BasicWidget: WidgetClass<BasicWidget>;

    /**
     * Activates note in the tree and in the note detail.
     *
     * @param notePath (or noteId)
     */
    activateNote(notePath: string): Promise<void>;
    /**
     * Activates newly created note. Compared to this.activateNote() also makes sure that frontend has been fully synced.
     *
     * @param notePath (or noteId)
     */
    activateNewNote(notePath: string): Promise<void>;
    /**
     * Open a note in a new tab.
     *
     * @method
     * @param notePath (or noteId)
     * @param activate - set to true to activate the new tab, false to stay on the current tab
     */
    openTabWithNote(notePath: string, activate: boolean): Promise<void>;
    /**
     * Open a note in a new split.
     *
     * @param notePath (or noteId)
     * @param activate - set to true to activate the new split, false to stay on the current split
     */
    openSplitWithNote(notePath: string, activate: boolean): Promise<void>;

    /**
     * Executes given anonymous function on the backend.
     * Internally this serializes the anonymous function into string and sends it to backend via AJAX.
     * Please make sure that the supplied function is synchronous. Only sync functions will work correctly
     * with transaction management. If you really know what you're doing, you can call api.runAsyncOnBackendWithManualTransactionHandling()
     *
     * @method
     * @param func - (synchronous) function to be executed on the backend
     * @param params - list of parameters to the anonymous function to be sent to backend
     * @returns return value of the executed function on the backend
     */
    runOnBackend(func: Func, params?: unknown[]): Promise<unknown>;
    /**
     * Executes given anonymous function on the backend.
     * Internally this serializes the anonymous function into string and sends it to backend via AJAX.
     * This function is meant for advanced needs where an async function is necessary.
     * In this case, the automatic request-scoped transaction management is not applied,
     * and you need to manually define transaction via api.transactional().
     *
     * If you have a synchronous function, please use api.runOnBackend().
     *
     * @method
     * @param func - (synchronous) function to be executed on the backend
     * @param params - list of parameters to the anonymous function to be sent to backend
     * @returns return value of the executed function on the backend
     */
    runAsyncOnBackendWithManualTransactionHandling(func: Func, params?: unknown[]): Promise<unknown>;

    /**
     * Whether backend script execution is enabled on the server (the
     * `[Security] backendScriptingEnabled` config toggle). When it's disabled,
     * `api.runOnBackend()` / `api.runAsyncOnBackendWithManualTransactionHandling()`
     * reject with a "Backend script execution is disabled" error, so check this
     * first to let a script degrade gracefully instead of throwing.
     */
    isBackendScriptingEnabled(): boolean;
    /**
     * Whether the SQL console is enabled on the server (the
     * `[Security] sqlConsoleEnabled` config toggle). When it's disabled, backend
     * scripts that run raw SQL (`api.sql.*`) fail, so check this before invoking
     * SQL-backed logic via `api.runOnBackend()`.
     */
    isSqlConsoleEnabled(): boolean;

    /**
     * This is a powerful search method - you can search by attributes and their values, e.g.:
     * "#dateModified =* MONTH AND #log". See full documentation for all options at: https://triliumnext.github.io/Docs/Wiki/search.html
     */
    searchForNotes(searchString: string): Promise<ScriptFNote[]>;
    /**
     * This is a powerful search method - you can search by attributes and their values, e.g.:
     * "#dateModified =* MONTH AND #log". See full documentation for all options at: https://triliumnext.github.io/Docs/Wiki/search.html
     */
    searchForNote(searchString: string): Promise<ScriptFNote | null>;
    /**
     * Returns note by given noteId. If note is missing from the cache, it's loaded.
     */
    getNote(noteId: string): Promise<ScriptFNote | null>;
    /**
     * Returns list of notes. If note is missing from the cache, it's loaded.
     *
     * This is often used to bulk-fill the cache with notes which would have to be picked one by one
     * otherwise (by e.g. createLink())
     *
     * @param [silentNotFoundError] - don't report error if the note is not found
     */
    getNotes(noteIds: string[], silentNotFoundError?: boolean): Promise<ScriptFNote[]>;
    /**
     * Update frontend tree (note) cache from the backend.
     */
    reloadNotes(noteIds: string[]): Promise<void>;
    /**
     * Creates a new note as a child of the given parent, entirely on the frontend — no backend
     * scripting required (unlike `api.runOnBackend(() => api.createTextNote(...))`). By default the
     * new note is activated in the current tab with its title focused for editing; pass
     * `{ activate: false }` to create it silently.
     *
     * @param parentNotePath note path (or noteId) of the parent under which to create the note
     * @param opts creation options — e.g. `{ title, content, type, mime, activate }`
     * @returns the created note and its branch, resolved from the frontend cache
     */
    createNote(parentNotePath: string, opts?: ScriptCreateNoteOpts): Promise<{ note: ScriptFNote | null; branch: ScriptFBranch | undefined }>;
    /**
     * Instance name identifies particular Trilium instance. It can be useful for scripts
     * if some action needs to happen on only one specific instance.
     */
    getInstanceName(): string | null;

    /**
     * Adds given text to the editor cursor
     *
     * @param text - this must be clear text, HTML is not supported.
     */
    addTextToActiveContextEditor(text: string): void;
    /**
     * @returns active note (loaded into center pane)
     */
    getActiveContextNote(): ScriptFNote;
    /**
     * Obtains the currently active/focused split in the current tab.
     *
     * Note that this method does not return the note context of the "Quick edit" panel, it will return the note context behind it.
     */
    getActiveContext(): ScriptNoteContext;
    /**
     * Obtains the main context of the current tab. This is the left-most split.
     *
     * Note that this method does not return the note context of the "Quick edit" panel, it will return the note context behind it.
     */
    getActiveMainContext(): ScriptNoteContext;
    /**
     * @returns returns all note contexts (splits) in all tabs
     */
    getNoteContexts(): ScriptNoteContext[];
    /**
     * @returns returns all main contexts representing tabs
     */
    getMainNoteContexts(): ScriptNoteContext[];
    /**
     * See https://ckeditor.com/docs/ckeditor5/latest/api/module_core_editor_editor-Editor.html for documentation on the returned instance.
     *
     * @returns {Promise<BalloonEditor>} instance of CKEditor
     */
    getActiveContextTextEditor(): Promise<unknown>;
    /**
     * See https://codemirror.net/doc/manual.html#api
     *
     * @method
     * @returns instance of CodeMirror
     */
    getActiveContextCodeEditor(): Promise<unknown>;
    /**
     * Get access to the widget handling note detail. Methods like `getWidgetType()` and `getTypeWidget()` to get to the
     * implementation of actual widget type.
     */
    getActiveNoteDetailWidget(): Promise<unknown>;
    /**
     * @returns returns a note path of active note or null if there isn't active note
     */
    getActiveContextNotePath(): string | null;
    /**
     * Returns component which owns the given DOM element (the nearest parent component in DOM tree)
     *
     * @method
     * @param el DOM element
     */
    getComponentByEl(el: HTMLElement): unknown;

    /**
     * Show an info toast message to the user.
     */
    showMessage(message: string, delay?: number): void;
    /**
     * Show an error toast message to the user.
     */
    showError(message: string, delay?: number): void;
    /**
     * Show an info dialog to the user.
     */
    showInfoDialog(message: string): Promise<void>;
    /**
     * Show confirm dialog to the user.
     * @returns promise resolving to true if the user confirmed
     */
    showConfirmDialog(message: string): Promise<boolean>;
    /**
     * Show prompt dialog to the user.
     *
     * @returns promise resolving to the answer provided by the user
     */
    showPromptDialog(props: { title?: string; message?: string; defaultValue?: string }): Promise<string | null>;

    /**
     * Show a dialog for picking one item out of many, grouped and searchable.
     *
     * `items` are either the items themselves or groups of them, never the two mixed. Named for the
     * one thing it does now: picking several at once will be a method of its own beside this.
     *
     * @returns promise resolving to the item picked, or null where the user backed out.
     */
    pickSingleItem(props: {
        title?: string;
        items: PickerItem[] | PickerItemGroup[];
        placeholder?: string;
    }): Promise<PickerItem | null>;

    /**
     * Create a note link (jQuery object) for given note.
     *
     * @param {string} notePath (or noteId)
     * @param {object} [params]
     * @param {boolean} [params.showTooltip] - enable/disable tooltip on the link
     * @param {boolean} [params.showNotePath] - show also whole note's path as part of the link
     * @param {boolean} [params.showNoteIcon] - show also note icon before the title
     * @param {string} [params.title] - custom link tile with note's title as default
     * @param {string} [params.title=] - custom link tile with note's title as default
     * @returns {jQuery} - jQuery element with the link (wrapped in <span>)
     */
    createLink(notePath: string, params?: Record<string, unknown>): unknown;
    /** @deprecated - use api.createLink() instead */
    createNoteLink(notePath: string, params?: Record<string, unknown>): unknown;

    /**
     * Trigger command. This is a very low-level API which should be avoided if possible.
     */
    triggerCommand(name: string, data?: Record<string, unknown>): Promise<unknown>;
    /**
     * Trigger event. This is a very low-level API which should be avoided if possible.
     */
    triggerEvent(name: string, data?: Record<string, unknown>): Promise<unknown>;
    /**
     * @param {object} $el - jquery object on which to set up the tooltip
     */
    setupElementTooltip(el: unknown): void;
    /**
     * @param {boolean} protect - true to protect note, false to unprotect
     */
    protectNote(noteId: string, protect: boolean): Promise<void>;
    /**
     * @param noteId
     * @param protect - true to protect subtree, false to unprotect
     */
    protectSubTree(noteId: string, protect: boolean): Promise<void>;

    /**
     * Returns date-note for today. If it doesn't exist, it is automatically created.
     */
    getTodayNote(): Promise<ScriptFNote>;
    /**
     * Returns day note for a given date. If it doesn't exist, it is automatically created.
     *
     * @param date - e.g. "2019-04-29"
     */
    getDayNote(date: string): Promise<ScriptFNote>;
    /**
     * Returns day note for the first date of the week of the given date. If it doesn't exist, it is automatically created.
     *
     * @param date - e.g. "2019-04-29"
     */
    getWeekFirstDayNote(date: string): Promise<ScriptFNote>;
    /**
     * Returns week note for given date. If such a note doesn't exist, it is automatically created.
     *
     * @param date in YYYY-MM-DD format
     * @param rootNote - specify calendar root note, normally leave empty to use the default calendar
     */
    getWeekNote(date: string): Promise<ScriptFNote>;
    /**
     * Returns month-note. If it doesn't exist, it is automatically created.
     *
     * @param month - e.g. "2019-04"
     */
    getMonthNote(month: string): Promise<ScriptFNote>;
    /**
     * Returns quarter note for given date. If such a note doesn't exist, it is automatically created.
     *
     * @param date in YYYY-MM format
     * @param rootNote - specify calendar root note, normally leave empty to use the default calendar
     */
    getQuarterNote(date: string): Promise<ScriptFNote>;
    /**
     * Returns year-note. If it doesn't exist, it is automatically created.
     *
     * @method
     * @param {string} year - e.g. "2019"
     * @returns {Promise<FNote>}
     */
    getYearNote(year: string): Promise<ScriptFNote>;

    /**
     * Hoist note in the current tab. See https://triliumnext.github.io/Docs/Wiki/note-hoisting.html
     *
     * @param {string} noteId - set hoisted note. 'root' will effectively unhoist
     */
    setHoistedNoteId(noteId: string): void;
    /**
     * @param keyboardShortcut - e.g. "ctrl+shift+a"
     * @param [namespace] specify namespace of the handler for the cases where call for bind may be repeated.
     *                               If a handler with this ID exists, it's replaced by the new handler.
     */
    bindGlobalShortcut(keyboardShortcut: string, handler: () => void, namespace?: string): void;
    /**
     * Trilium runs in a backend and frontend process, when something is changed on the backend from a script,
     * frontend will get asynchronously synchronized.
     *
     * This method returns a promise which resolves once all the backend -> frontend synchronization is finished.
     * Typical use case is when a new note has been created, we should wait until it is synced into frontend and only then activate it.
     */
    waitUntilSynced(): Promise<unknown>;
    /**
     * This will refresh all currently opened notes which have included note specified in the parameter
     *
     * @param includedNoteId - noteId of the included note
     */
    refreshIncludedNote(includedNoteId: string): void;

    /**
     * Return randomly generated string of given length. This random string generation is NOT cryptographically secure.
     *
     * @method
     * @param length of the string
     * @returns random string
     */
    randomString(length: number): string;
    /**
     * @param size in bytes
     * @return formatted string
     */
    formatSize(size: number): string;
    /**
     * @param size in bytes
     * @return formatted string
     * @deprecated - use api.formatSize()
     */
    formatNoteSize(size: number): string;
    /**
     * Converts the given HTML string to Markdown.
     *
     * Unlike the backend API, this runs on the server (the HTML→Markdown
     * converter is backend-only), so it returns a promise.
     *
     * @param html - HTML content to convert
     * @returns Markdown representation of the input HTML
     */
    htmlToMarkdown(html: string): Promise<string>;
    /**
     * Converts the given Markdown string to HTML.
     *
     * Runs entirely in the browser; the promise is only needed because the
     * Markdown renderer is loaded on demand.
     *
     * @param markdown - Markdown content to convert
     * @returns HTML representation of the input Markdown
     */
    markdownToHtml(markdown: string): Promise<string>;
    /**
     * @returns date in YYYY-MM-DD format
     */
    formatDateISO(date: Date): string;
    /** Parses a date string into a Date. */
    parseDate(str: string): Date;

    /** Per-note log message buffers shown in the UI log pane. */
    logMessages: Record<string, string[]>;
    /** Per-note spaced-update handlers for the log pane. */
    logSpacedUpdates: Record<string, unknown>;
    /**
     * Log given message to the log pane in UI.
     * Accepts multiple arguments which are joined with spaces, similar to `console.log`.
     */
    log(...args: unknown[]): void;

    /** The Preact API surface (components, hooks) for render scripts. */
    preact: unknown;
}

/** A branch (note→parent placement) as seen by backend scripts (subset of `BBranch`). */
export interface ScriptBBranch {
    /**
     * The ID of the branch. Moving a note to another parent replaces its branch with a new one, so
     * store the note ID rather than the branch ID when you need a stable reference.
     */
    branchId: string;
    /** The ID of the child note this branch places in the tree. */
    noteId: string;
    /** The ID of the parent note. For the root note's branch, it is `"none"`. */
    parentNoteId: string;
    /**
     * The text shown before the note's title in the note tree for this placement only, or `null` if
     * there is none.
     */
    prefix: string | null;
    /**
     * The position of the note among its siblings under this parent; notes with lower values come
     * first.
     */
    notePosition: number;
    /** Whether the note is expanded in the note tree at this placement, showing its children. */
    isExpanded: boolean;
    /** Returns the child note this branch places in the tree. */
    getNote(): ScriptBNote;
    /** Returns the parent note. The root note's branch has no parent note. */
    getParentNote(): ScriptBNote | null;
}

/** A note revision as seen by backend scripts (subset of trilium-core's `BRevision`). */
export interface ScriptBRevision {
    /** The ID of the revision. */
    revisionId?: string;
    /** The ID of the note this revision belongs to. */
    noteId: string;
    /** The note's type at the time of the revision, such as `"text"` or `"code"`. */
    type: string;
    /** The note's MIME type at the time of the revision. */
    mime: string;
    /**
     * The note's title at the time of the revision. For a protected revision outside a protected
     * session, it is `"[protected]"`.
     */
    title: string;
    /**
     * When the note was last edited before the revision was saved, in local time with its UTC
     * offset, formatted as `YYYY-MM-DD HH:mm:ss.SSS+ZZZZ` (for example, `2026-10-22
     * 14:05:09.123+0200`).
     */
    dateLastEdited?: string;
    /**
     * When the note was last edited before the revision was saved, in UTC, formatted as `YYYY-MM-DD
     * HH:mm:ss.SSSZ` (for example, `2026-10-22 12:05:09.123Z`).
     */
    utcDateLastEdited?: string;
    /**
     * The size of the revision's content in bytes, when it was loaded together with the revision.
     * Revisions returned by `note.getRevisions()` and `note.saveRevision()` leave it `undefined`.
     */
    contentLength?: number;
    /**
     * Returns the content of the revision: a string for text-based note types, a `Uint8Array` for
     * binary ones such as images and files. For a protected revision outside a protected session,
     * it returns an empty string.
     */
    getContent(): string | Uint8Array;
    /**
     * Returns the revision's content parsed as JSON. Returns `null` when the content is empty,
     * blank or binary, and throws an error when it is not valid JSON.
     */
    getJsonContent(): unknown;
}

/** Result of a clone operation ({@link ScriptBNote.cloneTo}); mirrors `CloneResponse`. */
export interface ScriptCloneResponse {
    success: boolean;
    message?: string;
    branchId?: string;
    notePath?: string;
}

/** A single parent→child link in a subtree ({@link ScriptBNote.getSubtree}). */
export interface ScriptSubtreeRelationship {
    parentNoteId: string;
    childNoteId: string;
}

/** Options accepted by the subtree traversal helpers on {@link ScriptBNote}. */
export interface ScriptSubtreeOpts {
    includeArchived?: boolean;
    includeHidden?: boolean;
    resolveSearch?: boolean;
}

/** Input accepted by {@link ScriptBNote.saveAttachment}. */
export interface ScriptSaveAttachmentInput {
    attachmentId?: string;
    role: string;
    mime: string;
    title: string;
    content?: string | Uint8Array;
    position?: number;
}

/** A note as seen by backend scripts (subset of trilium-core's `BNote`). */
export interface ScriptBNote {
    /**
     * The ID of the note. The root note's ID is `root`. System notes have IDs that start with `_`,
     * such as `_hidden`.
     */
    noteId: string;
    /**
     * The title of the note. For a protected note read outside a protected session, this holds the
     * encrypted title. Use `getTitleOrProtected()` to show a title safely.
     */
    title: string;
    /**
     * The note type, such as `text`, `code`, `file`, `image`, `search` or `book`. Together with
     * `mime`, it decides how Trilium renders the content.
     */
    type: string;
    /**
     * The MIME type of the note's content, such as `text/html` for a text note or
     * `application/javascript;env=backend` for a backend script.
     */
    mime: string;
    /**
     * Whether the note is protected. The title and content of a protected note are encrypted, and
     * can be read or changed only while a protected session is active.
     */
    isProtected: boolean;
    /**
     * Whether the note is archived: it has an `archived` label of its own or inherits one. A
     * non-inheritable `archived` label on an ancestor does not count; see
     * `areAllNotePathsArchived()`.
     */
    isArchived: boolean;
    /**
     * Whether the note has been deleted, or its deletion is in progress. It becomes `true` on an
     * object a script still holds after the note is deleted.
     */
    isDeleted: boolean;
    /** Share root ID this note is published under, if any. */
    shareId: string;
    /**
     * The ID of the blob that stores the note's content. It changes whenever the content changes,
     * and notes with identical content share a blob.
     */
    blobId: string;
    /**
     * The date and time the note was created, in local time with its UTC offset, for example
     * `2026-10-22 14:03:05.123+0200`.
     */
    dateCreated: string;
    /**
     * The date and time the note was last modified, in local time with its UTC offset, for example
     * `2026-10-22 14:03:05.123+0200`. It changes when the content changes or the note itself is
     * saved, such as after a title change.
     */
    dateModified: string;
    /** The date and time the note was created, in UTC, for example `2026-10-22 12:03:05.123Z`. */
    utcDateCreated: string;
    /**
     * The date and time the note was last modified, in UTC, for example `2026-10-22 12:03:05.123Z`.
     * It changes when the content changes or the note itself is saved.
     */
    utcDateModified: string;

    // --- Content -----------------------------------------------------------
    /**
     * Returns the content of the note: a string for text-based notes (see `hasStringContent()`), a
     * `Uint8Array` for binary ones such as images and files. The content is read from the database
     * on each call. For a protected note outside a protected session, it returns an empty string.
     */
    getContent(): string | Uint8Array;
    /**
     * Replaces the content of the note and saves it immediately; there is no need to call `save()`
     * afterwards. If the content is unchanged, nothing is saved and `dateModified` stays the same.
     *
     * The call throws an error when `content` is `null` or `undefined`, when the note is protected
     * and no protected session is active, and when the note is read-only, such as a page of the
     * in-app help.
     *
     * @param content The new content: a string for text-based notes, or a `Uint8Array` for binary
     * ones such as images and files.
     * @param opts.forceFrontendReload Whether open editors showing this note reload the new
     * content, even when the change appears to come from them.
     */
    setContent(content: string | Uint8Array, opts?: { forceFrontendReload?: boolean }): void;
    /**
     * Returns the note's content parsed as JSON. Returns `null` when the content is empty, blank or
     * binary, and throws an error when it is not valid JSON.
     */
    getJsonContent<T = unknown>(): T | null;
    /**
     * Returns the note's content parsed as JSON, like `getJsonContent()`, but returns `null`
     * instead of throwing an error when the content is not valid JSON.
     */
    getJsonContentSafely(): unknown;
    /**
     * Serializes `content` to JSON, indented with tabs, and saves it as the note's content through
     * `setContent()`, with the same errors.
     */
    setJsonContent(content: unknown): void;
    /**
     * Returns whether `getContent()` returns a string rather than a `Uint8Array`. This holds for
     * text, code, canvas, Mermaid and other text-based note types, and for MIME types such as
     * `text/*`, `application/json`, `application/javascript` and `image/svg+xml`.
     */
    hasStringContent(): boolean;
    /**
     * Returns a file name for the note, as used when it is downloaded or exported: the title with
     * characters invalid in file names removed (`untitled` when the title is empty), plus an
     * extension. The extension is `.html` for text notes, `.json` for relation maps, canvases and
     * saved searches, and otherwise comes from the MIME type, unless the title already ends in a
     * matching one.
     */
    getFileName(): string;
    /**
     * Returns a single line of text that Trilium searches when matching notes: the note ID, type,
     * MIME type, branch prefixes, title and attributes (as `#name=value` and `~name=value`,
     * inherited ones included), lowercased and with diacritics removed. The content is not
     * included.
     */
    getFlatText(): string;
    /** Plain serialisable representation of the note (the real return type is `NotePojo`). */
    getPojo(): Record<string, unknown>;
    /**
     * Returns the note's title, or the literal string `[protected]` when the note is protected and
     * no protected session is active.
     */
    getTitleOrProtected(): string;
    /**
     * Returns the CSS classes of the note's icon, for example `tn-icon bx bx-note`. The icon comes
     * from the note's `iconClass` label (its own or inherited) when it has one, and otherwise from
     * its type.
     */
    getIcon(): string;

    // --- Hierarchy ---------------------------------------------------------
    /**
     * The parent notes of this note: one per place the note appears in the tree, so a cloned note
     * has several. Parents that are not archived come first. This is the same array
     * `getParentNotes()` returns; don't modify it.
     */
    parents: ScriptBNote[];
    /**
     * The child notes of this note, in their order in the tree. This is the same array
     * `getChildNotes()` returns; don't modify it.
     */
    children: ScriptBNote[];
    /**
     * The branches that place this note under each of its parents, in the same order as `parents`.
     * This is the same array `getParentBranches()` returns; don't modify it.
     */
    parentBranches: ScriptBBranch[];
    /** The number of parent notes, which is greater than 1 for a cloned note. */
    parentCount: number;
    /** The number of child notes, including hidden and system notes. */
    childrenCount: number;
    /**
     * Returns the parent notes of this note, one per place the note appears in the tree. Parents
     * that are not archived come first. The result is the `parents` array itself; don't modify it.
     */
    getParentNotes(): ScriptBNote[];
    /**
     * Returns the child notes of this note, in their order in the tree. The result is the
     * `children` array itself; don't modify it.
     */
    getChildNotes(): ScriptBNote[];
    /**
     * Returns the child notes that are shown in a shared note's navigation tree, in tree order. It
     * leaves out system notes, whose IDs start with `_`, and notes with a `shareHiddenFromTree`
     * label, their own or inherited. Archived notes are included.
     */
    getVisibleChildNotes(): ScriptBNote[];
    /**
     * Returns the branches that place this note under each of its parents. The result is the
     * `parentBranches` array itself; don't modify it.
     */
    getParentBranches(): ScriptBBranch[];
    /**
     * Returns the branches that connect this note to each of its children, in their order in the
     * tree. A branch holds the child's position and prefix.
     */
    getChildBranches(): ScriptBBranch[];
    /**
     * Returns the child branches whose notes are shown in a shared note's navigation tree, in tree
     * order. It leaves out system notes, whose IDs start with `_`, and notes with a
     * `shareHiddenFromTree` label, their own or inherited. Archived notes are included.
     */
    getVisibleChildBranches(): ScriptBBranch[];
    /**
     * Returns the parent branches the user created, leaving out the automatic placements under the
     * shared notes (`_share`) and the bookmarks (`_lbBookmarks`). A note whose last such branch is
     * deleted is deleted too.
     */
    getStrongParentBranches(): ScriptBBranch[];
    /**
     * Returns the same branches as `getChildBranches()`. Despite its name, it filters nothing:
     * archived and hidden children are included.
     */
    getFilteredChildBranches(): ScriptBBranch[];
    /**
     * Returns the branches that place this note under each of its parents.
     *
     * @deprecated Use `getParentBranches()` instead.
     */
    getBranches(): ScriptBBranch[];
    /** Returns whether the note has at least one child note, including hidden and system notes. */
    hasChildren(): boolean;
    /** Returns whether `getVisibleChildNotes()` returns at least one note. */
    hasVisibleChildren(): boolean;
    /**
     * Returns every ancestor of the note across all of its paths in the tree, each note once, up to
     * and including the root note. The note itself is not included. The order follows the parents:
     * each parent comes first, followed by its own ancestors.
     */
    getAncestors(): ScriptBNote[];
    /** Returns the IDs of the notes `getAncestors()` returns, in the same order. */
    getAncestorNoteIds(): string[];
    /**
     * Returns the IDs of this note and all its descendants.
     *
     * @deprecated Use `getSubtreeNoteIds()` instead.
     */
    getDescendantNoteIds(): string[];
    /**
     * Returns the number of levels between this note and the given ancestor along the shortest
     * path: `1` for a parent, `2` for a grandparent, and `0` for the note itself. If the note is
     * not a descendant of the given note, it returns `999999`.
     *
     * @param ancestorNoteId The ID of the ancestor note to measure the distance to.
     */
    getDistanceToAncestor(ancestorNoteId: string): number;
    /**
     * Returns whether the given note is an ancestor of this note on any of its paths. It returns
     * `false` for the note's own ID.
     *
     * @param ancestorNoteId The ID of the note to look for among the ancestors.
     */
    hasAncestor(ancestorNoteId: string): boolean;
    /**
     * Returns whether the given note lies on at least one of this note's paths from the root.
     * Unlike `hasAncestor()`, it returns `true` for the note's own ID.
     */
    isDescendantOfNote(ancestorNoteId: string): boolean;
    /** Returns whether this note is the root of the note tree, whose ID is `root`. */
    isRoot(): boolean;
    /**
     * Returns the note and all its descendants, each note once, together with every parent-child
     * relationship among them, including those of cloned notes.
     *
     * @param opts.includeArchived Whether archived notes, and the subtrees below them, are
     * included. Defaults to `true`.
     * @param opts.includeHidden Whether the hidden subtree (`_hidden`) is included when it lies
     * within the subtree. Defaults to `false`.
     * @param opts.resolveSearch Whether the results of saved search notes are included as their
     * children. Defaults to `false`.
     * @returns An object with `notes`, the notes of the subtree including this note, and
     * `relationships`, the `{ parentNoteId, childNoteId }` pairs connecting them.
     */
    getSubtree(opts?: ScriptSubtreeOpts): {
        notes: ScriptBNote[];
        relationships: ScriptSubtreeRelationship[];
    };
    /**
     * Returns the IDs of this note and all its descendants, each once. Takes the same options as
     * `getSubtree()`.
     */
    getSubtreeNoteIds(opts?: ScriptSubtreeOpts): string[];
    /**
     * Returns the notes that this note's inheritable attributes reach: the note itself, its
     * descendants, and every note that uses one of them as a `template` or `inherit` relation
     * target, along with that note's descendants. Each note appears once; the hidden subtree
     * (`_hidden`) is skipped.
     */
    getSubtreeNotesIncludingTemplated(): ScriptBNote[];
    /**
     * Returns the notes that this note's non-inheritable attributes apply to: the note itself and
     * every note that uses it as a `template` or `inherit` relation target. Their descendants are
     * not included.
     */
    getInheritingNotes(): ScriptBNote[];

    // --- Note paths --------------------------------------------------------
    /**
     * Returns every path from the root note to this note, one per placement in the tree. Each path
     * is an array of note IDs that starts with `root` and ends with this note's ID.
     */
    getAllNotePaths(): string[][];
    /**
     * Returns the best path from the root note to this note as an array of note IDs, ranked as in
     * `getSortedNotePathRecords()`.
     *
     * @param hoistedNoteId The ID of the note whose subtree is preferred. Defaults to `root`.
     */
    getBestNotePath(hoistedNoteId?: string): string[];
    /**
     * Returns the best path from the root note to this note as a string of note IDs joined by `/`,
     * for example `root/a1h315/js725h`.
     *
     * @param hoistedNoteId The ID of the note whose subtree is preferred. Defaults to `root`.
     */
    getBestNotePathString(hoistedNoteId?: string): string;
    /**
     * Returns a record for every path from the root note to this note, best path first. Paths
     * within the hoisted note's subtree come first, then paths without archived notes, then paths
     * outside the hidden subtree, then shorter paths.
     *
     * @param hoistedNoteId The ID of the note whose subtree is preferred. Defaults to `root`.
     * @returns Records whose `notePath` holds the note IDs from the root to this note, with flags
     * telling whether the path lies within the hoisted subtree (`isInHoistedSubTree`), passes
     * through an archived note, the note itself included (`isArchived`), or lies within the hidden
     * subtree (`isHidden`).
     */
    getSortedNotePathRecords(hoistedNoteId?: string): ScriptNotePathRecord[];
    /**
     * Returns whether every path to this note passes through an archived note. Unlike `isArchived`,
     * this also counts a non-inheritable `archived` label on an ancestor. It throws an error if the
     * note has no path from the root.
     */
    areAllNotePathsArchived(): boolean;

    // --- Attributes (read) -------------------------------------------------
    /** The labels and relations defined directly on this note, without inherited ones. */
    ownedAttributes: ScriptAttribute[];
    /**
     * The relations in other notes (or this one) that point to this note. This includes the link
     * relations Trilium creates automatically for links in note content, such as `internalLink` and
     * `imageLink`.
     */
    targetRelations: ScriptAttribute[];
    /**
     * The number of labels and relations on this note, inherited ones and automatic link relations
     * included.
     */
    attributeCount: number;
    /**
     * The number of labels and relations defined directly on this note, automatic link relations
     * included.
     */
    ownedAttributeCount: number;
    /** The number of labels on this note, inherited ones included. */
    labelCount: number;
    /** The number of labels defined directly on this note. */
    ownedLabelCount: number;
    /**
     * The number of relations on this note, inherited ones included. Excludes the link relations
     * Trilium creates automatically for links in note content (`internalLink`, `imageLink`,
     * `relationMapLink`, `includeNoteLink`).
     */
    relationCount: number;
    /**
     * The number of relations on this note, inherited ones included, together with the link
     * relations Trilium creates automatically for links in note content.
     */
    relationCountIncludingLinks: number;
    /**
     * The number of relations defined directly on this note, excluding the link relations Trilium
     * creates automatically for links in note content.
     */
    ownedRelationCount: number;
    /**
     * The number of relations defined directly on this note, together with the link relations
     * Trilium creates automatically for links in note content.
     */
    ownedRelationCountIncludingLinks: number;
    /**
     * The number of relations in other notes that point to this note, excluding the link relations
     * Trilium creates automatically for links in note content.
     */
    targetRelationCount: number;
    /**
     * The number of relations in other notes that point to this note, together with the link
     * relations Trilium creates automatically for links in note content.
     */
    targetRelationCountIncludingLinks: number;
    /**
     * Returns the labels and relations of this note, inherited ones included, optionally filtered
     * by type and name. Without a filter, the result is the note's own cached array; don't modify
     * it.
     *
     * @param type `"label"` or `"relation"`; any other value throws an error.
     * @param name The attribute name, without the leading `#` or `~`.
     */
    getAttributes(type?: string, name?: string): ScriptAttribute[];
    /**
     * Returns the labels and relations defined directly on this note, optionally filtered by type
     * and name. Without a filter, the result is the `ownedAttributes` array itself; don't modify
     * it.
     *
     * @param type `"label"` or `"relation"`; any other value throws an error.
     * @param name The attribute name, without the leading `#` or `~`.
     */
    getOwnedAttributes(type?: string, name?: string): ScriptAttribute[];
    /**
     * Returns the first attribute of the given type and name, inherited ones included, or `null` if
     * there is none.
     *
     * @param type `"label"` or `"relation"`.
     */
    getAttribute(type: string, name: string): ScriptAttribute | null;
    /**
     * Returns the first attribute of the given type and name defined directly on this note, or
     * `null` if there is none. It skips inheritance, so it can be much faster than
     * `getAttribute()`.
     *
     * @param type `"label"` or `"relation"`.
     * @param value The value to match; when omitted, any value matches.
     */
    getOwnedAttribute(type: string, name: string, value?: string | null): ScriptAttribute | null;
    /**
     * Returns the value of the first attribute of the given type and name, inherited ones
     * included, or `null` if there is none. For a relation, the value is the target note's ID.
     *
     * @param type `"label"` or `"relation"`.
     */
    getAttributeValue(type: string, name: string): string | null;
    /**
     * Returns the value of the first attribute of the given type and name defined directly on this
     * note, or `null` if there is none. For a relation, the value is the target note's ID.
     *
     * @param type `"label"` or `"relation"`.
     */
    getOwnedAttributeValue(type: string, name: string): string | null;
    /**
     * Returns the attribute of this note with the given ID, inherited ones included, or `undefined`
     * if there is none.
     */
    getAttributeById(attributeId: string): ScriptAttribute | undefined;
    /**
     * Returns the first attribute of the given type whose name, and optionally value, matches
     * regardless of letter case, or `undefined` if none does. Inherited attributes are included.
     *
     * @param type `"label"` or `"relation"`.
     * @param value The value to match; an empty or omitted value matches any value.
     */
    getAttributeCaseInsensitive(
        type: string,
        name: string,
        value?: string | null
    ): ScriptAttribute | undefined;
    /**
     * Returns `true` if the note has a label or relation of the given type and name, inherited ones
     * included.
     *
     * @param type `"label"` or `"relation"`.
     */
    hasAttribute(type: string, name: string): boolean;
    /**
     * Returns whether the note has a label or relation of the given type and name defined directly
     * on it. Inherited attributes don't count.
     *
     * @param type `"label"` or `"relation"`.
     * @param value The value to match; when omitted, any value matches.
     */
    hasOwnedAttribute(type: string, name: string, value?: string): boolean;
    /**
     * Returns the attribute definitions on this note, inherited ones included. Currently returns
     * the same `#relation:*` definitions as `getRelationDefinitions()`, not the `#label:*` ones; to
     * read label definitions, filter `getLabels()` by names that start with `label:`.
     */
    getLabelDefinitions(): ScriptAttribute[];
    /**
     * Returns the relation definitions on this note, inherited ones included: the `#relation:*`
     * labels that declare promoted relations, such as `#relation:author="promoted,single"`.
     */
    getRelationDefinitions(): ScriptAttribute[];
    /**
     * Returns the relations in other notes (or this one) that point to this note, the automatic
     * link relations included. Same as `targetRelations`.
     */
    getTargetRelations(): ScriptAttribute[];

    // --- Labels ------------------------------------------------------------
    /**
     * Returns the first label with the given name, inherited ones included, or `null` if there is
     * none. Pass the name without the leading `#`.
     */
    getLabel(name: string): ScriptAttribute | null;
    /**
     * Returns the first label with the given name defined directly on this note, or `null` if there
     * is none.
     */
    getOwnedLabel(name: string): ScriptAttribute | null;
    /**
     * Returns the labels of this note, inherited ones included. When `name` is given, only labels
     * with that name are returned.
     */
    getLabels(name?: string): ScriptAttribute[];
    /** Returns the labels with the given name defined directly on this note. */
    getOwnedLabels(name: string): ScriptAttribute[];
    /**
     * Returns the value of the first label with the given name, inherited ones included, or `null`
     * if there is none. A label without a value returns an empty string.
     */
    getLabelValue(name: string): string | null;
    /**
     * Returns the value of the first label with the given name defined directly on this note, or
     * `null` if there is none.
     */
    getOwnedLabelValue(name: string): string | null;
    /**
     * Returns the values of all labels with the given name, inherited ones included, for labels
     * that can occur more than once.
     */
    getLabelValues(name: string): string[];
    /** Returns the values of all labels with the given name defined directly on this note. */
    getOwnedLabelValues(name: string): string[];
    /** Returns whether the note has a label with the given name, inherited ones included. */
    hasLabel(name: string): boolean;
    /**
     * Returns whether the note has a label with the given name defined directly on it.
     *
     * @param value The value to match; when omitted, any value matches.
     */
    hasOwnedLabel(name: string, value?: string): boolean;
    /**
     * Returns whether the note has a label with the given name, inherited ones included, whose
     * value is not `"false"`. A label without a value counts as `true`.
     */
    isLabelTruthy(name: string): boolean;
    /**
     * Returns `true` if the note has an inheritable `#archived` label, owned or inherited, so that
     * the note's descendants are archived too.
     */
    hasInheritableArchivedLabel(): boolean;

    // --- Relations ---------------------------------------------------------
    /**
     * Returns the first relation with the given name, inherited ones included, or `null` if there
     * is none. Pass the name without the leading `~`.
     */
    getRelation(name: string): ScriptAttribute | null;
    /**
     * Returns the first relation with the given name defined directly on this note, or `null` if
     * there is none.
     */
    getOwnedRelation(name: string): ScriptAttribute | null;
    /**
     * Returns the relations of this note, inherited ones included. When `name` is given, only
     * relations with that name are returned.
     */
    getRelations(name?: string): ScriptAttribute[];
    /**
     * Returns the relations defined directly on this note. When `name` is given, only relations
     * with that name are returned.
     */
    getOwnedRelations(name?: string | null): ScriptAttribute[];
    /**
     * Returns the ID of the note that the first relation with the given name points to, inherited
     * relations included, or `null` if there is none. To get the note itself, use
     * `getRelationTarget()`.
     */
    getRelationValue(name: string): string | null;
    /**
     * Returns the ID of the note that the first relation with the given name defined directly on
     * this note points to, or `null` if there is none.
     */
    getOwnedRelationValue(name: string): string | null;
    /**
     * Returns the note that the first relation with the given name points to, or `null` if the note
     * has no such relation. Inherited relations are included.
     */
    getRelationTarget(name: string): ScriptBNote | null;
    /**
     * Returns whether the note has a relation with the given name, inherited ones included.
     *
     * @param value The ID of the target note to match; when omitted, any target matches.
     */
    hasRelation(name: string, value?: string): boolean;
    /**
     * Returns whether the note has a relation with the given name defined directly on it.
     *
     * @param value The ID of the target note to match; when omitted, any target matches.
     */
    hasOwnedRelation(name: string, value?: string): boolean;

    // --- Attributes (write) ------------------------------------------------
    /**
     * Adds a label to this note, saves it and returns it. It adds a new label even when the note
     * already has one with that name; to change an existing label instead, use `setLabel()`.
     *
     * @param name The label name, without the leading `#`.
     * @param value The label value. Defaults to an empty string.
     * @param isInheritable Whether the note's descendants inherit the label. Defaults to `false`.
     */
    addLabel(name: string, value?: string, isInheritable?: boolean): ScriptAttribute;
    /**
     * Adds a relation from this note to another note, saves it and returns it. It adds a new
     * relation even when the note already has one with that name; to change an existing relation
     * instead, use `setRelation()`.
     *
     * @param name The relation name, without the leading `~`.
     * @param isInheritable Whether the note's descendants inherit the relation. Defaults to
     * `false`.
     */
    addRelation(name: string, targetNoteId: string, isInheritable?: boolean): ScriptAttribute;
    /**
     * Adds a label or relation to this note, saves it and returns it. `addLabel()` and
     * `addRelation()` do the same for one type.
     *
     * @param type `"label"` or `"relation"`.
     * @param name The attribute name, without the leading `#` or `~`.
     * @param value The label's text, or the relation's target note ID. Defaults to an empty string.
     * @param isInheritable Whether the note's descendants inherit the attribute. Defaults to
     * `false`.
     */
    addAttribute(
        type: string,
        name: string,
        value?: string,
        isInheritable?: boolean
    ): ScriptAttribute;
    /**
     * Sets the value of the first label with the given name defined directly on this note, or adds
     * a non-inheritable label if the note has none of its own. Inherited labels are left alone. The
     * change is saved immediately.
     *
     * @param value The new value. Defaults to an empty string.
     */
    setLabel(name: string, value?: string): void;
    /**
     * Points the first relation with the given name defined directly on this note to another note,
     * or adds a non-inheritable relation if the note has none of its own. Inherited relations are
     * left alone. The change is saved immediately.
     *
     * @param value The ID of the target note.
     */
    setRelation(name: string, value?: string): void;
    /**
     * Sets the value of the first attribute of the given type and name defined directly on this
     * note, or adds a non-inheritable one if the note has none of its own. `setLabel()` and
     * `setRelation()` do the same for one type. The change is saved immediately.
     *
     * @param type `"label"` or `"relation"`.
     * @param value The label's text, or the relation's target note ID. Defaults to an empty string.
     */
    setAttribute(type: string, name: string, value?: string): void;
    /**
     * Sets the value of the attribute with the given ID, which must be defined directly on this
     * note, and saves it. Throws an error if the note has no such attribute of its own.
     *
     * @param value The new value. Defaults to an empty string.
     */
    setAttributeValueById(attributeId: string, value?: string): void;
    /**
     * Sets the label like `setLabel()` when `enabled` is `true`, and removes it like
     * `removeLabel()` when it is `false`.
     */
    toggleLabel(enabled: boolean, name: string, value?: string): void;
    /**
     * Sets the relation like `setRelation()` when `enabled` is `true`, and removes it like
     * `removeRelation()` when it is `false`.
     *
     * @param value The ID of the target note.
     */
    toggleRelation(enabled: boolean, name: string, value?: string): void;
    /**
     * Sets the attribute like `setAttribute()` when `enabled` is `true`, and removes it like
     * `removeAttribute()` when it is `false`.
     *
     * @param type `"label"` or `"relation"`.
     */
    toggleAttribute(type: string, enabled: boolean, name: string, value?: string): void;
    /**
     * Removes every label with the given name defined directly on this note. Inherited labels are
     * not affected.
     *
     * @param value The value to match; when omitted, labels with any value are removed.
     */
    removeLabel(name: string, value?: string): void;
    /**
     * Removes every relation with the given name defined directly on this note. Inherited
     * relations are not affected.
     *
     * @param value The ID of the target note to match; when omitted, relations to any note are
     * removed.
     */
    removeRelation(name: string, value?: string): void;
    /**
     * Removes every attribute of the given type and name defined directly on this note. Inherited
     * attributes are not affected.
     *
     * @param type `"label"` or `"relation"`.
     * @param value The value to match; when omitted, attributes with any value are removed.
     */
    removeAttribute(type: string, name: string, value?: string): void;
    /**
     * Returns `true` if another note uses this note as its template or inheritance source, through
     * a `~template` or `~inherit` relation. Despite the name, it does not tell whether this note
     * inherits attributes itself.
     */
    isInherited(): boolean;

    // --- Revisions & attachments -------------------------------------------
    /**
     * The number of revisions of this note. It is `null` until a search that filters or sorts by
     * `revisionCount` or one of the size properties has run; `getRevisions().length` always works.
     */
    revisionCount: number | null;
    /** Returns the saved revisions of this note, oldest first. */
    getRevisions(): ScriptBRevision[];
    /**
     * Saves a revision that snapshots the note's current title, content and attachments, and
     * returns it. Afterwards, Trilium erases the oldest revisions beyond the number the revision
     * settings keep.
     *
     * @param opts `description` names the revision; `source` records what created it: `"auto"` (the
     * default), `"manual"`, `"etapi"`, `"llm"` or `"restore"`.
     */
    saveRevision(opts?: { description?: string; source?: string }): ScriptBRevision;
    /**
     * Returns the attachments of this note, ordered by position. Deleted attachments are excluded.
     */
    getAttachments(): ScriptAttachment[];
    /**
     * Returns the attachment of this note with the given ID. Returns `undefined` if this note has
     * no such attachment, although the type does not say so.
     */
    getAttachmentById(attachmentId: string): ScriptAttachment;
    /**
     * Returns the first attachment of this note whose title matches exactly, or `undefined` if none
     * does.
     */
    getAttachmentByTitle(title: string): ScriptAttachment | undefined;
    /**
     * Returns the attachments of this note with the given role, such as `"image"` or `"file"`,
     * ordered by position.
     */
    getAttachmentsByRole(role: string): ScriptAttachment[];
    /**
     * Saves an attachment of this note and returns it. If an existing attachment matches, only its
     * content is replaced; otherwise a new attachment is created from `attachment`, protected if
     * the note is. Missing content is saved as an empty string.
     *
     * @param matchBy How to find an existing attachment to update: `"attachmentId"` (the default)
     * by `attachment.attachmentId`, which throws an error if no attachment has that ID, or
     * `"title"` by `attachment.title` among this note's attachments.
     */
    saveAttachment(
        attachment: ScriptSaveAttachmentInput,
        matchBy?: "attachmentId" | "title"
    ): ScriptAttachment;
    /**
     * Converts this image note into an image attachment of its parent text note, points the
     * parent's content at the attachment, deletes this note and returns the attachment. Returns
     * `null` and changes nothing when `isEligibleForConversionToAttachment()` returns `false`.
     *
     * @param opts Pass `{ autoConversion: true }` to also require that the parent links the image.
     */
    convertToParentAttachment(opts?: Record<string, unknown>): ScriptAttachment | null;
    /**
     * Returns `true` if this note can be converted into an attachment of its parent: it is an image
     * note with no children and a single parent, the parent is a text note, both are readable in
     * the current session, and at most one `~imageLink` relation points to the image, from the
     * parent.
     *
     * @param opts Pass `{ autoConversion: true }` to also require that the parent links the image.
     */
    isEligibleForConversionToAttachment(opts?: Record<string, unknown>): boolean;

    // --- Sizes -------------------------------------------------------------
    /**
     * The size of the note's content in bytes. Like the other size properties, it is `null` until a
     * search that filters or sorts by one of them, or by `revisionCount`, has run.
     */
    contentSize: number | null;
    /**
     * The size in bytes of the note's content together with its attachments, counting content
     * that several of them share once. It is `null` until a search that uses it has run.
     */
    contentAndAttachmentsSize: number | null;
    /**
     * The size in bytes of the note's content together with its attachments and its revisions and
     * their attachments, counting shared content once. It is `null` until a search that uses it has
     * run.
     */
    contentAndAttachmentsAndRevisionsSize: number | null;

    // --- Tree operations ---------------------------------------------------
    /**
     * Places this note under another parent note as well, keeping its existing placements, and
     * expands the new parent in the note tree. The result does not throw on failure; check
     * `success`, and read `message` for why it failed (for example, the note is already in that
     * parent, the target is a search note, or the clone would create a cycle).
     *
     * @param parentNoteId The ID of the note to clone into.
     * @returns On success, `branchId` of the new branch and `notePath` of the clone.
     */
    cloneTo(parentNoteId: string): ScriptCloneResponse;
    /**
     * Deletes the note from every place in the tree, together with its descendants that have no
     * other placement, and runs its `runOnNoteDeletion` relations first. Deleted notes stay
     * recoverable until they are erased. Does nothing if the note is already deleted.
     *
     * @param deleteId An ID that groups the deleted notes, branches and attributes so that they can
     * be restored together. Defaults to a new random ID.
     */
    deleteNote(deleteId?: string | null): void;
    /**
     * Reorders this note's `parents` and `parentBranches` in memory so that archived and hidden
     * parents come last, which makes Trilium prefer the other paths when it picks a note path.
     * Saves nothing.
     */
    sortParents(): void;
    /**
     * Reorders this note's `children` array in memory by each child's `notePosition`. Saves nothing
     * and does not change the order shown in the note tree.
     */
    sortChildren(): void;

    // --- Search ------------------------------------------------------------
    /**
     * Returns the notes that match a search query. Despite the name, the search covers the whole
     * tree, not only this note's subtree, and leaves out archived and hidden notes; to limit it to
     * this note's subtree, call `api.searchForNotes(query, { ancestorNoteId: note.noteId })`.
     */
    searchNotesInSubtree(searchString: string): ScriptBNote[];
    /**
     * Returns the first note that matches a search query, or `undefined` if none does. Like
     * `searchNotesInSubtree()`, the search covers the whole tree, not only this note's subtree.
     */
    searchNoteInSubtree(searchString: string): ScriptBNote | null;
    /**
     * Runs the saved search of a search note and returns the notes it finds. Returns an empty array
     * for other note types, and when the search fails (the error goes to the backend log).
     */
    getSearchResultNotes(): ScriptBNote[];

    // --- Type & state predicates -------------------------------------------
    /**
     * Returns `true` if this note is a search note or has at least one child, archived children
     * included.
     */
    isFolder(): boolean;
    /**
     * Returns `true` if the note's title and content can be read: the note is not protected, or a
     * protected session is open. Otherwise the content reads as an empty string and the title as
     * `"[protected]"`.
     */
    isContentAvailable(): boolean;
    /**
     * Returns whether `getContent()` returns a string rather than a `Uint8Array`.
     *
     * @deprecated Use `hasStringContent()` instead.
     */
    isStringNote(): boolean;
    /** Returns whether this is a code, file or render note with the MIME type `text/html`. */
    isHtml(): boolean;
    /** Returns whether this is an image note, or a file note with an `image/*` MIME type. */
    isImage(): boolean;
    /** Returns whether this is a code, file or launcher note with a JavaScript MIME type. */
    isJavaScript(): boolean;
    /** Returns `true` if this is a code note with the MIME type `text/jsx`. */
    isJsx(): boolean;
    /** Returns whether the note's MIME type is `application/json`, whatever its type. */
    isJson(): boolean;
    /** Returns whether this is a code note with a Markdown MIME type. */
    isMarkdown(): boolean;
    /**
     * Returns `true` if this note is one of the settings pages in the hidden subtree, whose IDs
     * start with `_options`.
     */
    isOptions(): boolean;
    /**
     * Returns `true` if this note is a launcher or one of the containers that configure the desktop
     * or mobile launch bar.
     */
    isLaunchBarConfig(): boolean;
    /**
     * Returns whether every path to this note passes through the hidden subtree (`_hidden`), so
     * that the note has no placement in the visible tree. Returns `false` for the root note and for
     * `_hidden` itself.
     */
    isHiddenCompletely(): boolean;
    /**
     * Returns `true` if this note is the hidden root note (`_hidden`) or lies under it in any of
     * its placements. The hidden subtree holds Trilium's system notes, such as settings, launchers
     * and templates.
     */
    isInHiddenSubtree(): boolean;

    // --- Scripting runtime -------------------------------------------------
    /**
     * Returns where the note runs as a script: `"backend"` for JavaScript with `env=backend` in its
     * MIME type, `"frontend"` for frontend JavaScript, JSX, HTML and render notes, and `null` for
     * notes that are not scripts.
     */
    getScriptEnv(): "frontend" | "backend" | null;
    /**
     * Runs this note as a backend script and returns the script's return value, which is a promise
     * for an async script. The note must be a backend JavaScript code note; for any other note it
     * runs nothing and returns `undefined`. Throws an error if the note is protected and no
     * protected session is active, or if backend scripting is disabled.
     */
    executeScript(): unknown;
}

/** Result of the backend note-creation helpers. */
export interface ScriptNoteAndBranch {
    note: ScriptBNote;
    branch: ScriptBBranch;
}

/**
 * Minimal Express `Request` surface available to **custom request handlers**
 * (a subset of Express's `Request` — re-declared here to keep this module
 * self-contained). Only the commonly used members are typed; the real object is
 * a full Express request.
 */
export interface ScriptRequest {
    /** Route/path parameters. */
    params: Record<string, string>;
    /** Parsed query-string parameters. */
    query: Record<string, unknown>;
    /** Parsed request body (requires a matching body parser). */
    body: unknown;
    /** Request headers (lower-cased names). */
    headers: Record<string, string | string[] | undefined>;
    /** HTTP method, e.g. "GET", "POST". */
    method: string;
    /** Request URL (path + query string). */
    url: string;
    /** Returns the value of the given (case-insensitive) header. */
    get(headerName: string): string | undefined;
}

/**
 * Minimal Express `Response` surface available to **custom request handlers**
 * (a subset of Express's `Response`). Write the HTTP response through this
 * object, e.g. `api.res.status(200).json({ ok: true })`.
 */
export interface ScriptResponse {
    /** Sets the HTTP status code (chainable). */
    status(code: number): ScriptResponse;
    /** Sends the response body (string, Buffer, object, …) and ends the response. */
    send(body?: unknown): ScriptResponse;
    /** Sends a JSON response and ends the response. */
    json(body: unknown): ScriptResponse;
    /** Sets a response header (chainable). */
    setHeader(name: string, value: string | string[]): ScriptResponse;
    /** Sets a response header (Express alias of `setHeader`, chainable). */
    set(field: string, value?: string): ScriptResponse;
    /** Redirects to the given URL. */
    redirect(url: string): void;
    /** Ends the response without further data. */
    end(): void;
}

/**
 * The `api` global available inside **backend** script notes
 * (`application/javascript;env=backend`). Runs server-side: no DOM, no jQuery.
 */
export interface BackendApi {
    /**
     * Note where the script execution started — the entry point of the current script bundle
     * (in C terms, the file containing `main()`). When a script is spread across multiple code
     * notes (descendant code notes loaded as modules via `require()`), every note in the
     * bundle shares the same `startNote`, while {@link currentNote} differs per note.
     * Messages from `api.log()` are grouped under this note.
     *
     * When a frontend script calls `api.runOnBackend()`, the frontend's `startNote` is
     * preserved here; since that note may not be resolvable on the backend, this can be null.
     */
    startNote?: ScriptBNote | null;
    /**
     * Note containing the source code that is currently executing (in C terms, `__FILE__`).
     * Equal to {@link startNote} unless execution has moved into a descendant module note
     * loaded via `require()`. Don't confuse this with the concept of the active note in
     * the UI.
     */
    currentNote: ScriptBNote;
    /**
     * Entity whose event triggered this execution; `undefined` when the run was not
     * event-driven (e.g. started manually via "Execute script" or `note.executeScript()`).
     *
     * What it holds depends on the trigger:
     * - `~runOnNoteCreation`, `~runOnNoteChange`, `~runOnNoteTitleChange`,
     *   `~runOnNoteContentChange` — the affected note;
     * - `~runOnChildNoteCreation` — the newly created child note;
     * - `~runOnAttributeCreation`, `~runOnAttributeChange` — the attribute;
     * - `~runOnBranchCreation`, `~runOnBranchChange`, `~runOnBranchDeletion` — the branch;
     * - scheduled scripts (`#run=backendStartup` / `#run=hourly` / `#run=daily`) — the
     *   script note itself;
     * - search scripts (`~searchScript`) — the search note.
     */
    originEntity?: unknown | null;

    /**
     * The HTTP request, present only when the script runs as a custom request handler: a note
     * with the `#customRequestHandler` label, invoked through a `/custom/...` URL. It is
     * `undefined` in every other backend script. The object is Express's own request, so it has
     * more members than `ScriptRequest` lists.
     */
    req: ScriptRequest;
    /**
     * The HTTP response to write the reply to, such as `api.res.status(200).json({ ok: true })`.
     * Like `req`, it is present only in custom request handlers, and is Express's own response.
     */
    res: ScriptResponse;
    /**
     * The capture groups from the `#customRequestHandler` regex that matched this
     * request's URL, in order. Available only inside custom request handlers.
     */
    pathParams: string[];

    /**
     * day.js library for date manipulation. See {@link https://day.js.org} for documentation
     */
    dayjs: ScriptDayjs;
    /**
     * xml2js library for XML parsing. See {@link https://github.com/Leonidas-from-XIV/node-xml2js} for documentation
     */
    xml2js: unknown;
    /**
     * node-html-parser library for HTML parsing. See {@link https://github.com/taoqf/node-fast-html-parser} for documentation.
     */
    htmlParser: unknown;

    /**
     * Instance name identifies particular Trilium instance. It can be useful for scripts
     * if some action needs to happen on only one specific instance.
     */
    getInstanceName(): string | null;

    /** Returns a note by its ID, or null. */
    getNote(noteId: string): ScriptBNote | null;
    /** Returns a branch by its ID, or null. */
    getBranch(branchId: string): ScriptBBranch | null;
    /** Returns an attribute by its ID, or null. */
    getAttribute(attributeId: string): ScriptAttribute | null;
    /** Returns an attachment by its ID, or null. */
    getAttachment(attachmentId: string): unknown | null;
    /** Returns a revision by its ID, or null. */
    getRevision(revisionId: string): unknown | null;
    /** Returns an ETAPI token by its ID, or null. */
    getEtapiToken(etapiTokenId: string): unknown | null;
    /** Returns all ETAPI tokens. */
    getEtapiTokens(): unknown[];
    /** Returns an option by name, or null. */
    getOption(optionName: string): unknown | null;
    /** Returns all options. */
    getOptions(): unknown[];

    /**
     * This is a powerful search method - you can search by attributes and their values, e.g.:
     * "#dateModified =* MONTH AND #log". See {@link https://triliumnext.github.io/Docs/Wiki/search.html} for full documentation for all options
     */
    searchForNotes(query: string, searchParams?: Record<string, unknown>): ScriptBNote[];
    /**
     * This is a powerful search method - you can search by attributes and their values, e.g.:
     * "#dateModified =* MONTH AND #log". See {@link https://triliumnext.github.io/Docs/Wiki/search.html} for full documentation for all options
     */
    searchForNote(query: string, searchParams?: Record<string, unknown>): ScriptBNote | null;
    /**
     * Retrieves notes with given label name & value
     *
     * @param name - attribute name
     * @param value - attribute value
     */
    getNotesWithLabel(name: string, value?: string): ScriptBNote[];
    /**
     * Retrieves first note with given label name & value
     *
     * @param name - attribute name
     * @param value - attribute value
     */
    getNoteWithLabel(name: string, value?: string): ScriptBNote | null;

    /**
     * If there's no branch between note and parent note, create one. Otherwise, do nothing. Returns the new or existing branch.
     *
     * @param prefix - if branch is created between note and parent note, set this prefix
     */
    ensureNoteIsPresentInParent(noteId: string, parentNoteId: string, prefix?: string): { branch: ScriptBBranch | null };
    /**
     * If there's a branch between note and parent note, remove it. Otherwise, do nothing.
     */
    ensureNoteIsAbsentFromParent(noteId: string, parentNoteId: string): void;
    /**
     * Based on the value, either create or remove branch between note and parent note.
     *
     * @param present - true if we want the branch to exist, false if we want it gone
     * @param prefix - if branch is created between note and parent note, set this prefix
     */
    toggleNoteInParent(present: boolean, noteId: string, parentNoteId: string, prefix?: string): void;

    /**
     * Create text note. See also createNewNote() for more options.
     */
    createTextNote(parentNoteId: string, title: string, content: string): ScriptNoteAndBranch;
    /**
     * Create data note - data in this context means object serializable to JSON. Created note will be of type 'code' and
     * JSON MIME type. See also createNewNote() for more options.
     */
    createDataNote(parentNoteId: string, title: string, content: object): ScriptNoteAndBranch;
    /**
     * @returns object contains newly created entities note and branch
     */
    createNewNote(params: {
        parentNoteId: string;
        title: string;
        content: string | Uint8Array;
        type: string;
        mime?: string;
        [key: string]: unknown;
    }): ScriptNoteAndBranch;

    /** Per-note log message buffers shown in the UI log pane. */
    logMessages: Record<string, string[]>;
    /** Per-note spaced-update handlers for the log pane. */
    logSpacedUpdates: Record<string, unknown>;
    /**
     * Log given message to trilium logs and log pane in UI.
     * Accepts multiple arguments which are joined with spaces, similar to `console.log`.
     */
    log(...args: unknown[]): void;

    /**
     * Returns root note of the calendar.
     */
    getRootCalendarNote(): ScriptBNote | null;
    /**
     * Returns day note for given date. If such note doesn't exist, it is created.
     *
     * @method
     * @param date in YYYY-MM-DD format
     * @param rootNote - specify calendar root note, normally leave empty to use the default calendar
     */
    getDayNote(date: string, rootNote?: ScriptBNote): ScriptBNote | null;
    /**
     * Returns today's day note. If such note doesn't exist, it is created.
     *
     * @param rootNote specify calendar root note, normally leave empty to use the default calendar
     */
    getTodayNote(rootNote?: ScriptBNote): ScriptBNote | null;
    /**
     * Returns note for the first date of the week of the given date.
     *
     * @param date in YYYY-MM-DD format
     * @param rootNote - specify calendar root note, normally leave empty to use the default calendar
     */
    getWeekFirstDayNote(date: string, rootNote?: ScriptBNote): ScriptBNote | null;
    /**
     * Returns week note for given date. If such a note doesn't exist, it is created.
     *
     * <p>
     * If the calendar does not support week notes, this method will return `null`.
     *
     * @param date in YYYY-MM-DD format
     * @param rootNote - specify calendar root note, normally leave empty to use the default calendar
     * @return an existing or newly created week note, or `null` if the calendar does not support week notes.
     */
    getWeekNote(date: string, rootNote?: ScriptBNote): ScriptBNote | null;
    /**
     * Returns month note for given date. If such a note doesn't exist, it is created.
     *
     * @param date in YYYY-MM format
     * @param rootNote - specify calendar root note, normally leave empty to use the default calendar
     */
    getMonthNote(date: string, rootNote?: ScriptBNote): ScriptBNote | null;
    /**
     * Returns quarter note for given date. If such a note doesn't exist, it is created.
     *
     * @param date in YYYY-MM format
     * @param rootNote - specify calendar root note, normally leave empty to use the default calendar
     */
    getQuarterNote(date: string, rootNote?: ScriptBNote): ScriptBNote | null;
    /**
     * Returns year note for given year. If such a note doesn't exist, it is created.
     *
     * @param year in YYYY format
     * @param rootNote - specify calendar root note, normally leave empty to use the default calendar
     */
    getYearNote(year: string, rootNote?: ScriptBNote): ScriptBNote | null;

    /**
     * Sort child notes of a given note. `sortBy` takes the `#sorted` grammar — comma-separated
     * levels of `title`, `dateCreated`, `dateModified` or a label name, each optionally followed by
     * `asc` or `desc` (`priority desc, dueDate`); `reverse` is the direction of the levels without
     * their own, of the folders grouping and of ties.
     */
    sortNotes(parentNoteId: string, sortConfig: { sortBy?: string; reverse?: boolean; foldersFirst?: boolean }): void;
    /**
     * This method finds note by its noteId and prefix and either sets it to the given parentNoteId
     * or removes the branch (if parentNoteId is not given).
     *
     * This method looks similar to toggleNoteInParent() but differs because we're looking up branch by prefix.
     *
     * @deprecated this method is pretty confusing and serves specialized purpose only
     */
    setNoteToParent(noteId: string, prefix: string, parentNoteId: string | null): void;
    /**
     * This functions wraps code which is supposed to be running in transaction. If transaction already
     * exists, then we'll use that transaction.
     *
     * @param func
     * @returns result of func callback
     */
    transactional<T>(func: () => T): T;

    /**
     * Return randomly generated string of given length. This random string generation is NOT cryptographically secure.
     *
     * @param length of the string
     * @returns random string
     */
    randomString(length: number): string;
    /**
     * @param to escape
     * @returns escaped string
     */
    escapeHtml(str: string): string;
    /**
     * @param string to unescape
     * @returns unescaped string
     */
    unescapeHtml(str: string): string;
    /**
     * Converts the given HTML string to Markdown.
     *
     * @param html - HTML content to convert
     * @returns Markdown representation of the input HTML
     */
    htmlToMarkdown(html: string): string;
    /**
     * Converts the given Markdown string to HTML.
     *
     * @param markdown - Markdown content to convert
     * @returns HTML representation of the input Markdown
     */
    markdownToHtml(markdown: string): string;
    /**
     * sql
     * @type {module:sql}
     */
    sql: unknown;
    /** Application info (version, build date, etc.). */
    getAppInfo(): unknown;

    /**
     * Creates a new launcher to the launchbar. If the launcher (id) already exists, it will be updated.
     */
    createOrUpdateLauncher(opts: {
        id: string;
        type: "note" | "script" | "customWidget";
        title: string;
        isVisible: boolean;
        icon: string;
        keyboardShortcut: string;
        targetNoteId?: string;
        scriptNoteId?: string;
        widgetNoteId?: string;
    }): { note: ScriptBNote };
    /**
     * @param format - either 'html' or 'markdown'
     */
    exportSubtreeToZipFile(noteId: string, format: "markdown" | "html", zipFilePath: string): Promise<void>;
    /**
     * Executes given anonymous function on the frontend(s).
     * Internally, this serializes the anonymous function into string and sends it to frontend(s) via WebSocket.
     * Note that there can be multiple connected frontend instances (e.g. in different tabs). In such case, all
     * instances execute the given function.
     *
     * @param script - script to be executed on the frontend
     * @param params - list of parameters to the anonymous function to be sent to frontend
     * @returns no return value is provided.
     */
    runOnFrontend(script: (() => void) | string, params?: unknown[]): void;
    /**
     * Sync process can make data intermittently inconsistent. Scripts which require strong data consistency
     * can use this function to wait for a possible sync process to finish and prevent new sync process from starting
     * while it is running.
     *
     * Because this is an async process, the inner callback doesn't have automatic transaction handling, so in case
     * you need to make some DB changes, you need to surround your call with api.transactional(...)
     *
     * @param callback - function to be executed while sync process is not running
     * @returns resolves once the callback is finished (callback is awaited)
     */
    runOutsideOfSync(callback: () => void): Promise<void>;
    /**
     * @param backupName - If the backupName is e.g. "now", then the backup will be written to "backup-now.db" file
     * @returns resolves once the backup is finished
     */
    backupNow(backupName: string): Promise<string>;
    /**
     * Enables the complete duplication of the specified original note and all its children into the specified parent note.
     * The new note will be named the same as the original, with (Dup) added to the end of it.
     *
     * @param origNoteId - the noteId for the original note to be duplicated
     * @param newParentNoteId - the noteId for the parent note where the duplication is to be placed.
     *
     * @returns the note and the branch of the newly created note.
     */
    duplicateSubtree(origNoteId: string, newParentNoteId: string): ScriptNoteAndBranch;
}
