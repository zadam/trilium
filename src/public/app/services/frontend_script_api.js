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

/**
 * <p>This is the main frontend API interface for scripts. All the properties and methods are published in the "api" object
 * available in the JS frontend notes. You can use e.g. <code>api.showMessage(api.startNote.title);</code></p>
 *
 * @constructor
 */
function FrontendScriptApi(startNote, currentNote, originEntity = null, $container = null) {
    /** @property {jQuery} container of all the rendered script content */
    this.$container = $container;

    /** @property {object} note where script started executing */
    this.startNote = startNote;
    /** @property {object} note where script is currently executing */
    this.currentNote = currentNote;
    /** @property {object|null} entity whose event triggered this execution */
    this.originEntity = originEntity;

    /** @property {dayjs} day.js library for date manipulation. See {@link https://day.js.org} for documentation */
    this.dayjs = dayjs;

    /** @property {RightPanelWidget} */
    this.RightPanelWidget = RightPanelWidget;

    /** @property {NoteContextAwareWidget} */
    this.NoteContextAwareWidget = NoteContextAwareWidget;

    /** @property {BasicWidget} */
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

        await appContext.tabManager.openContextWithNote(notePath, { activate });

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
     * @property {string} [opts.id] - id of the button, used to identify the old instances of this button to be replaced
     *                          ID is optional because of BC, but not specifying it is deprecated. ID can be alphanumeric only.
     * @property {string} opts.title
     * @property {string} [opts.icon] - name of the boxicon to be used (e.g. "time" for "bx-time" icon)
     * @property {function} opts.action - callback handling the click on the button
     * @property {string} [opts.shortcut] - keyboard shortcut for the button, e.g. "alt+t"
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
     * Executes given anonymous function on the backend.
     * Internally this serializes the anonymous function into string and sends it to backend via AJAX.
     *
     * @method
     * @param {string} script - script to be executed on the backend
     * @param {Array.<?>} params - list of parameters to the anonymous function to be sent to backend
     * @returns {Promise<*>} return value of the executed function on the backend
     */
    this.runOnBackend = async (script, params = []) => {
        if (typeof script === "function") {
            script = script.toString();
        }

        const ret = await server.post('script/exec', {
            script: script,
            params: prepareParams(params),
            startNoteId: startNote.noteId,
            currentNoteId: currentNote.noteId,
            originEntityName: "notes", // currently there's no other entity on frontend which can trigger event
            originEntityId: originEntity ? originEntity.noteId : null
        }, "script");

        if (ret.success) {
            await ws.waitForMaxKnownEntityChangeId();

            return ret.executionResult;
        }
        else {
            throw new Error(`server error: ${ret.error}`);
        }
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
     * Returns note by given noteId. If note is missing from cache, it's loaded.
     **
     * @method
     * @param {string} noteId
     * @returns {Promise<FNote>}
     */
    this.getNote = async noteId => await froca.getNote(noteId);

    /**
     * Returns list of notes. If note is missing from cache, it's loaded.
     *
     * This is often used to bulk-fill the cache with notes which would have to be picked one by one
     * otherwise (by e.g. createNoteLink())
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
     * Show info message to the user.
     *
     * @method
     * @param {string} message
     */
    this.showMessage = toastService.showMessage;

    /**
     * Show error message to the user.
     *
     * @method
     * @param {string} message
     */
    this.showError = toastService.showError;

    /**
     * Trigger command.
     *
     * @method
     * @param {string} name
     * @param {object} data
     */
    this.triggerCommand = (name, data) => appContext.triggerCommand(name, data);

    /**
     * Trigger event.
     *
     * @method
     * @param {string} name
     * @param {object} data
     */
    this.triggerEvent = (name, data) => appContext.triggerEvent(name, data);

    /**
     * Create note link (jQuery object) for given note.
     *
     * @method
     * @param {string} notePath (or noteId)
     * @param {object} [params]
     * @param {boolean} [params.showTooltip=true] - enable/disable tooltip on the link
     * @param {boolean} [params.showNotePath=false] - show also whole note's path as part of the link
     * @param {boolean} [params.showNoteIcon=false] - show also note icon before the title
     * @param {string} [params.title=] - custom link tile with note's title as default
     */
    this.createNoteLink = linkService.createNoteLink;

    /**
     * Adds given text to the editor cursor
     *
     * @method
     * @param {string} text - this must be clear text, HTML is not supported.
     */
    this.addTextToActiveContextEditor = text => appContext.triggerCommand('addTextToActiveEditor', {text});

    /**
     * @method
     * @returns {FNote} active note (loaded into right pane)
     */
    this.getActiveContextNote = () => appContext.tabManager.getActiveContextNote();

    /**
     * See https://ckeditor.com/docs/ckeditor5/latest/api/module_core_editor_editor-Editor.html for a documentation on the returned instance.
     *
     * @method
     * @returns {Promise<CKEditor>} instance of CKEditor
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
     * @returns {Promise<string|null>} returns note path of active note or null if there isn't active note
     */
    this.getActiveContextNotePath = () => appContext.tabManager.getActiveContextNotePath();

    /**
     * Returns component which owns given DOM element (the nearest parent component in DOM tree)
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
     * Trilium runs in backend and frontend process, when something is changed on the backend from script,
     * frontend will get asynchronously synchronized.
     *
     * This method returns a promise which resolves once all the backend -> frontend synchronization is finished.
     * Typical use case is when new note has been created, we should wait until it is synced into frontend and only then activate it.
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
     * @param {number} length of the string
     * @returns {string} random string
     */
    this.randomString = utils.randomString;

    /**
     * @method
     * @param {int} size in bytes
     * @return {string} formatted string
     */
    this.formatNoteSize = utils.formatNoteSize;

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
