import server from './server.js';
import utils from './utils.js';
import toastService from './toast.js';
import linkService from './link.js';
import froca from './froca.js';
import noteTooltipService from './note_tooltip.js';
import protectedSessionService from './protected_session.js';
import dateNotesService from './date_notes.js';
import searchService from './search.js';
import RightPanelWidget from '../widgets/right_panel_widget.js';
import ws from "./ws.js";
import appContext from "../components/app_context.js";
import NoteContextAwareWidget from "../widgets/note_context_aware_widget.js";
import BasicWidget from "../widgets/basic_widget.js";
import SpacedUpdate from "./spaced_update.js";
import shortcutService from "./shortcuts.js";
import dialogService from "./dialog.js";


/**
 * A whole number
 * @typedef {number} int
 */

/**
 * An instance of the frontend api available globally.
 * @global
 * @var {FrontendScriptApi} api
 */

/**
 * <p>This is the main frontend API interface for scripts. All the properties and methods are published in the "api" object
 * available in the JS frontend notes. You can use e.g. <code>api.showMessage(api.startNote.title);</code></p>
 *
 * @constructor
 */
function FrontendScriptApi(startNote, currentNote, originEntity = null, $container = null) {
    /**
     * Container of all the rendered script content
     * @type {jQuery}
     * */
    this.$container = $container;

    /**
     * Note where the script started executing, i.e., the (event) entrypoint of the current script execution.
     * @type {FNote}
     */
    this.startNote = startNote;

    /**
     * Note where the script is currently executing, i.e. the note where the currently executing source code is written.
     * @type {FNote}
     */
    this.currentNote = currentNote;

    /**
     * Entity whose event triggered this execution.
     * @type {object|null}
     */
    this.originEntity = originEntity;

    /**
     * day.js library for date manipulation.
     * See {@link https://day.js.org} for documentation
     * @see https://day.js.org
     * @type {dayjs}
     */
    this.dayjs = dayjs;

    /** @type {RightPanelWidget} */
    this.RightPanelWidget = RightPanelWidget;

    /** @type {NoteContextAwareWidget} */
    this.NoteContextAwareWidget = NoteContextAwareWidget;

    /** @type {BasicWidget} */
    this.BasicWidget = BasicWidget;

    /**
     * Activates note in the tree and in the note detail.
     *
     * @method
     * @param {string} notePath (or noteId)
     * @returns {Promise<void>}
     */
    this.activateNote = async notePath => {
        await appContext.tabManager.getActiveContext().setNote(notePath);
    };

    /**
     * Activates newly created note. Compared to this.activateNote() also makes sure that frontend has been fully synced.
     *
     * @param {string} notePath (or noteId)
     * @returns {Promise<void>}
     */
    this.activateNewNote = async notePath => {
        await ws.waitForMaxKnownEntityChangeId();

        await appContext.tabManager.getActiveContext().setNote(notePath);
        await appContext.triggerEvent('focusAndSelectTitle');
    };

    /**
     * Open a note in a new tab.
     *
     * @method
     * @param {string} notePath (or noteId)
     * @param {boolean} activate - set to true to activate the new tab, false to stay on the current tab
     * @returns {Promise<void>}
     */
    this.openTabWithNote = async (notePath, activate) => {
        await ws.waitForMaxKnownEntityChangeId();

        await appContext.tabManager.openTabWithNoteWithHoisting(notePath, { activate });

        if (activate) {
            await appContext.triggerEvent('focusAndSelectTitle');
        }
    };

    /**
     * Open a note in a new split.
     *
     * @method
     * @param {string} notePath (or noteId)
     * @param {boolean} activate - set to true to activate the new split, false to stay on the current split
     * @returns {Promise<void>}
     */
    this.openSplitWithNote = async (notePath, activate) => {
        await ws.waitForMaxKnownEntityChangeId();

        const subContexts = appContext.tabManager.getActiveContext().getSubContexts();
        const {ntxId} = subContexts[subContexts.length - 1];

        await appContext.triggerCommand("openNewNoteSplit", {ntxId, notePath});

        if (activate) {
            await appContext.triggerEvent('focusAndSelectTitle');
        }
    };

    /**
     * Adds a new launcher to the launchbar. If the launcher (id) already exists, it will be updated.
     *
     * @method
     * @deprecated you can now create/modify launchers in the top-left Menu -> Configure Launchbar
     *             for special needs there's also backend API's createOrUpdateLauncher()
     * @param {object} opts
     * @param {string} opts.title
     * @param {function} opts.action - callback handling the click on the button
     * @param {string} [opts.id] - id of the button, used to identify the old instances of this button to be replaced
     *                          ID is optional because of BC, but not specifying it is deprecated. ID can be alphanumeric only.
     * @param {string} [opts.icon] - name of the boxicon to be used (e.g. "time" for "bx-time" icon)
     * @param {string} [opts.shortcut] - keyboard shortcut for the button, e.g. "alt+t"
     */
    this.addButtonToToolbar = async opts => {
        console.warn("api.addButtonToToolbar() has been deprecated since v0.58 and may be removed in the future. Use  Menu -> Configure Launchbar to create/update launchers instead.");

        const {action, ...reqBody} = opts;
        reqBody.action = action.toString();

        await server.put('special-notes/api-script-launcher', reqBody);
    };

    function prepareParams(params) {
        if (!params) {
            return params;
        }

        return params.map(p => {
            if (typeof p === "function") {
                return `!@#Function: ${p.toString()}`;
            }
            else {
                return p;
            }
        });
    }

    /**
     * @private
     */
    this.__runOnBackendInner = async (func, params, transactional) => {
        if (typeof func === "function") {
            func = func.toString();
        }

        const ret = await server.post('script/exec', {
            script: func,
            params: prepareParams(params),
            startNoteId: startNote.noteId,
            currentNoteId: currentNote.noteId,
            originEntityName: "notes", // currently there's no other entity on the frontend which can trigger event
            originEntityId: originEntity ? originEntity.noteId : null,
            transactional
        }, "script");

        if (ret.success) {
            await ws.waitForMaxKnownEntityChangeId();

            return ret.executionResult;
        } else {
            throw new Error(`server error: ${ret.error}`);
        }
    }

    /**
     * Executes given anonymous function on the backend.
     * Internally this serializes the anonymous function into string and sends it to backend via AJAX.
     * Please make sure that the supplied function is synchronous. Only sync functions will work correctly
     * with transaction management. If you really know what you're doing, you can call api.runAsyncOnBackendWithManualTransactionHandling()
     *
     * @method
     * @param {function|string} func - (synchronous) function to be executed on the backend
     * @param {Array.<?>} params - list of parameters to the anonymous function to be sent to backend
     * @returns {Promise<*>} return value of the executed function on the backend
     */
    this.runOnBackend = async (func, params = []) => {
        if (func?.constructor.name === "AsyncFunction" || func?.startsWith?.("async ")) {
            toastService.showError("You're passing an async function to api.runOnBackend() which will likely not work as you intended. "
                + "Either make the function synchronous (by removing 'async' keyword), or use api.runAsyncOnBackendWithManualTransactionHandling()");
        }

        return await this.__runOnBackendInner(func, params, true);
    };

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
     * @param {function|string} func - (synchronous) function to be executed on the backend
     * @param {Array.<?>} params - list of parameters to the anonymous function to be sent to backend
     * @returns {Promise<*>} return value of the executed function on the backend
     */
    this.runAsyncOnBackendWithManualTransactionHandling = async (func, params = []) => {
        if (func?.constructor.name === "Function" || func?.startsWith?.("function")) {
            toastService.showError("You're passing a synchronous function to api.runAsyncOnBackendWithManualTransactionHandling(), " +
                "while you should likely use api.runOnBackend() instead.");
        }

        return await this.__runOnBackendInner(func, params, false);
    };

    /**
     * This is a powerful search method - you can search by attributes and their values, e.g.:
     * "#dateModified =* MONTH AND #log". See full documentation for all options at: https://github.com/zadam/trilium/wiki/Search
     *
     * @method
     * @param {string} searchString
     * @returns {Promise<FNote[]>}
     */
    this.searchForNotes = async searchString => {
        return await searchService.searchForNotes(searchString);
    };

    /**
     * This is a powerful search method - you can search by attributes and their values, e.g.:
     * "#dateModified =* MONTH AND #log". See full documentation for all options at: https://github.com/zadam/trilium/wiki/Search
     *
     * @method
     * @param {string} searchString
     * @returns {Promise<FNote|null>}
     */
    this.searchForNote = async searchString => {
        const notes = await this.searchForNotes(searchString);

        return notes.length > 0 ? notes[0] : null;
    };

    /**
     * Returns note by given noteId. If note is missing from the cache, it's loaded.
     **
     * @method
     * @param {string} noteId
     * @returns {Promise<FNote>}
     */
    this.getNote = async noteId => await froca.getNote(noteId);

    /**
     * Returns list of notes. If note is missing from the cache, it's loaded.
     *
     * This is often used to bulk-fill the cache with notes which would have to be picked one by one
     * otherwise (by e.g. createLink())
     *
     * @method
     * @param {string[]} noteIds
     * @param {boolean} [silentNotFoundError] - don't report error if the note is not found
     * @returns {Promise<FNote[]>}
     */
    this.getNotes = async (noteIds, silentNotFoundError = false) => await froca.getNotes(noteIds, silentNotFoundError);

    /**
     * Update frontend tree (note) cache from the backend.
     *
     * @method
     * @param {string[]} noteIds
     */
    this.reloadNotes = async noteIds => await froca.reloadNotes(noteIds);

    /**
     * Instance name identifies particular Trilium instance. It can be useful for scripts
     * if some action needs to happen on only one specific instance.
     *
     * @method
     * @returns {string}
     */
    this.getInstanceName = () => window.glob.instanceName;

    /**
     * @method
     * @param {Date} date
     * @returns {string} date in YYYY-MM-DD format
     */
    this.formatDateISO = utils.formatDateISO;

    /**
     * @method
     * @param {string} str
     * @returns {Date} parsed object
     */
    this.parseDate = utils.parseDate;

    /**
     * Show an info toast message to the user.
     *
     * @method
     * @param {string} message
     */
    this.showMessage = toastService.showMessage;

    /**
     * Show an error toast message to the user.
     *
     * @method
     * @param {string} message
     */
    this.showError = toastService.showError;

    /**
     * Show an info dialog to the user.
     *
     * @method
     * @param {string} message
     * @returns {Promise}
     */
    this.showInfoDialog = dialogService.info;

    /**
     * Show confirm dialog to the user.
     *
     * @method
     * @param {string} message
     * @returns {Promise<boolean>} promise resolving to true if the user confirmed
     */
    this.showConfirmDialog = dialogService.confirm;

    /**
     * Show prompt dialog to the user.
     *
     * @method
     * @param {object} props
     * @param {string} props.title
     * @param {string} props.message
     * @param {string} props.defaultValue
     * @returns {Promise<string>} promise resolving to the answer provided by the user
     */
    this.showPromptDialog = dialogService.prompt;

    /**
     * Show prompt for selecting a note to the user.
     */
    this.getNoteAutocomplete = dialogService.promptNoteAutocomplete;

    /**
     * Trigger command. This is a very low-level API which should be avoided if possible.
     *
     * @method
     * @param {string} name
     * @param {object} data
     */
    this.triggerCommand = (name, data) => appContext.triggerCommand(name, data);

    /**
     * Trigger event. This is a very low-level API which should be avoided if possible.
     *
     * @method
     * @param {string} name
     * @param {object} data
     */
    this.triggerEvent = (name, data) => appContext.triggerEvent(name, data);

    /**
     * Create a note link (jQuery object) for given note.
     *
     * @method
     * @param {string} notePath (or noteId)
     * @param {object} [params]
     * @param {boolean} [params.showTooltip=true] - enable/disable tooltip on the link
     * @param {boolean} [params.showNotePath=false] - show also whole note's path as part of the link
     * @param {boolean} [params.showNoteIcon=false] - show also note icon before the title
     * @param {string} [params.title] - custom link tile with note's title as default
     * @param {string} [params.title=] - custom link tile with note's title as default
     * @returns {jQuery} - jQuery element with the link (wrapped in <span>)
     */
    this.createLink = linkService.createLink;

    /** @deprecated - use api.createLink() instead */
    this.createNoteLink = linkService.createLink;

    /**
     * Adds given text to the editor cursor
     *
     * @method
     * @param {string} text - this must be clear text, HTML is not supported.
     */
    this.addTextToActiveContextEditor = text => appContext.triggerCommand('addTextToActiveEditor', {text});

    /**
     * @method
     * @returns {FNote} active note (loaded into center pane)
     */
    this.getActiveContextNote = () => appContext.tabManager.getActiveContextNote();

    /**
     * @method
     * @returns {NoteContext} - returns active context (split)
     */
    this.getActiveContext = () => appContext.tabManager.getActiveContext();

    /**
     * @method
     * @returns {NoteContext} - returns active main context (first split in a tab, represents the tab as a whole)
     */
    this.getActiveMainContext = () => appContext.tabManager.getActiveMainContext();

    /**
     * @method
     * @returns {NoteContext[]} - returns all note contexts (splits) in all tabs
     */
    this.getNoteContexts = () => appContext.tabManager.getNoteContexts();

    /**
     * @method
     * @returns {NoteContext[]} - returns all main contexts representing tabs
     */
    this.getMainNoteContexts = () => appContext.tabManager.getMainNoteContexts();

    /**
     * See https://ckeditor.com/docs/ckeditor5/latest/api/module_core_editor_editor-Editor.html for documentation on the returned instance.
     *
     * @method
     * @returns {Promise<BalloonEditor>} instance of CKEditor
     */
    this.getActiveContextTextEditor = () => appContext.tabManager.getActiveContext()?.getTextEditor();

    /**
     * See https://codemirror.net/doc/manual.html#api
     *
     * @method
     * @returns {Promise<CodeMirror>} instance of CodeMirror
     */
    this.getActiveContextCodeEditor = () => appContext.tabManager.getActiveContext()?.getCodeEditor();

    /**
     * Get access to the widget handling note detail. Methods like `getWidgetType()` and `getTypeWidget()` to get to the
     * implementation of actual widget type.
     *
     * @method
     * @returns {Promise<NoteDetailWidget>}
     */
    this.getActiveNoteDetailWidget = () => new Promise(resolve => appContext.triggerCommand('executeInActiveNoteDetailWidget', {callback: resolve}));

    /**
     * @method
     * @returns {Promise<string|null>} returns a note path of active note or null if there isn't active note
     */
    this.getActiveContextNotePath = () => appContext.tabManager.getActiveContextNotePath();

    /**
     * Returns component which owns the given DOM element (the nearest parent component in DOM tree)
     *
     * @method
     * @param {Element} el - DOM element
     * @returns {Component}
     */
    this.getComponentByEl = el => appContext.getComponentByEl(el);

    /**
     * @method
     * @param {object} $el - jquery object on which to set up the tooltip
     * @returns {Promise<void>}
     */
    this.setupElementTooltip = noteTooltipService.setupElementTooltip;

    /**
     * @method
     * @param {string} noteId
     * @param {boolean} protect - true to protect note, false to unprotect
     * @returns {Promise<void>}
     */
    this.protectNote = async (noteId, protect) => {
        await protectedSessionService.protectNote(noteId, protect, false);
    };

    /**
     * @method
     * @param {string} noteId
     * @param {boolean} protect - true to protect subtree, false to unprotect
     * @returns {Promise<void>}
     */
    this.protectSubTree = async (noteId, protect) => {
        await protectedSessionService.protectNote(noteId, protect, true);
    };

    /**
     * Returns date-note for today. If it doesn't exist, it is automatically created.
     *
     * @method
     * @returns {Promise<FNote>}
     */
    this.getTodayNote = dateNotesService.getTodayNote;

    /**
     * Returns day note for a given date. If it doesn't exist, it is automatically created.
     *
     * @method
     * @param {string} date - e.g. "2019-04-29"
     * @returns {Promise<FNote>}
     */
    this.getDayNote = dateNotesService.getDayNote;

    /**
     * Returns day note for the first date of the week of the given date. If it doesn't exist, it is automatically created.
     *
     * @method
     * @param {string} date - e.g. "2019-04-29"
     * @returns {Promise<FNote>}
     */
    this.getWeekNote = dateNotesService.getWeekNote;

    /**
     * Returns month-note. If it doesn't exist, it is automatically created.
     *
     * @method
     * @param {string} month - e.g. "2019-04"
     * @returns {Promise<FNote>}
     */
    this.getMonthNote = dateNotesService.getMonthNote;

    /**
     * Returns year-note. If it doesn't exist, it is automatically created.
     *
     * @method
     * @param {string} year - e.g. "2019"
     * @returns {Promise<FNote>}
     */
    this.getYearNote = dateNotesService.getYearNote;

    /**
     * Hoist note in the current tab. See https://github.com/zadam/trilium/wiki/Note-hoisting
     *
     * @method
     * @param {string} noteId - set hoisted note. 'root' will effectively unhoist
     * @returns {Promise<void>}
     */
    this.setHoistedNoteId = (noteId) => {
        const activeNoteContext = appContext.tabManager.getActiveContext();

        if (activeNoteContext) {
            activeNoteContext.setHoistedNoteId(noteId);
        }
    };

    /**
     * @method
     * @param {string} keyboardShortcut - e.g. "ctrl+shift+a"
     * @param {function} handler
     * @param {string} [namespace] - specify namespace of the handler for the cases where call for bind may be repeated.
     *                               If a handler with this ID exists, it's replaced by the new handler.
     * @returns {Promise<void>}
     */
    this.bindGlobalShortcut = shortcutService.bindGlobalShortcut;

    /**
     * Trilium runs in a backend and frontend process, when something is changed on the backend from a script,
     * frontend will get asynchronously synchronized.
     *
     * This method returns a promise which resolves once all the backend -> frontend synchronization is finished.
     * Typical use case is when a new note has been created, we should wait until it is synced into frontend and only then activate it.
     *
     * @method
     * @returns {Promise<void>}
     */
    this.waitUntilSynced = ws.waitForMaxKnownEntityChangeId;

    /**
     * This will refresh all currently opened notes which have included note specified in the parameter
     *
     * @param includedNoteId - noteId of the included note
     * @returns {Promise<void>}
     */
    this.refreshIncludedNote = includedNoteId => appContext.triggerEvent('refreshIncludedNote', {noteId: includedNoteId});

    /**
     * Return randomly generated string of given length. This random string generation is NOT cryptographically secure.
     *
     * @method
     * @param {int} length of the string
     * @returns {string} random string
     */
    this.randomString = utils.randomString;

    /**
     * @method
     * @param {int} size in bytes
     * @return {string} formatted string
     */
    this.formatSize = utils.formatSize;

    /**
     * @method
     * @param {int} size in bytes
     * @return {string} formatted string
     * @deprecated - use api.formatSize()
     */
    this.formatNoteSize = utils.formatSize;

    this.logMessages = {};
    this.logSpacedUpdates = {};

    /**
     * Log given message to the log pane in UI
     *
     * @param message
     * @returns {void}
     */
    this.log = message => {
        const {noteId} = this.startNote;

        message = `${utils.now()}: ${message}`;

        console.log(`Script ${noteId}: ${message}`);

        this.logMessages[noteId] = this.logMessages[noteId] || [];
        this.logSpacedUpdates[noteId] = this.logSpacedUpdates[noteId] || new SpacedUpdate(() => {
            const messages = this.logMessages[noteId];
            this.logMessages[noteId] = [];

            appContext.triggerEvent("apiLogMessages", {noteId, messages});
        }, 100);

        this.logMessages[noteId].push(message);
        this.logSpacedUpdates[noteId].scheduleUpdate();
    };
}

export default FrontendScriptApi;
