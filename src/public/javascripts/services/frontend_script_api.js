import treeService from './tree.js';
import server from './server.js';
import utils from './utils.js';
import infoService from './info.js';
import linkService from './link.js';
import treeCache from './tree_cache.js';

/**
 * @constructor
 * @hideconstructor
 */
function FrontendScriptApi(startNote, currentNote, originEntity = null) {
    const $pluginButtons = $("#plugin-buttons");

    /** @property {object} note where script started executing */
    this.startNote = startNote;
    /** @property {object} note where script is currently executing */
    this.currentNote = currentNote;
    /** @property {object|null} entity whose event triggered this execution */
    this.originEntity = originEntity;

    /**
     * Activates note in the tree and in the note detail.
     *
     * @method
     * @param {string} notePath (or noteId)
     * @returns {Promise<void>}
     */
    this.activateNote = treeService.activateNote;

    /**
     * Activates newly created note. Compared to this.activateNote() also refreshes tree.
     *
     * @param {string} notePath (or noteId)
     * @return {Promise<void>}
     */
    this.activateNewNote = async notePath => {
        await treeService.reload();

        await treeService.activateNote(notePath, true);
    };

    /**
     * Adds new button the the plugin area.
     *
     * @param {object} options
     */
    this.addButtonToToolbar = opts => {
        const buttonId = "toolbar-button-" + opts.title.replace(/[^a-zA-Z0-9]/g, "-");

        $("#" + buttonId).remove();

        const icon = $("<span>")
            .addClass("ui-icon ui-icon-" + opts.icon);

        const button = $('<button>')
            .addClass("btn btn-xs")
            .click(opts.action)
            .append(icon)
            .append($("<span>").text(opts.title));

        button.attr('id', buttonId);

        $pluginButtons.append(button);

        if (opts.shortcut) {
            $(document).bind('keydown', opts.shortcut, opts.action);

            button.attr("title", "Shortcut " + opts.shortcut);
        }
    };

    function prepareParams(params) {
        if (!params) {
            return params;
        }

        return params.map(p => {
            if (typeof p === "function") {
                return "!@#Function: " + p.toString();
            }
            else {
                return p;
            }
        });
    }

    /**
     * Executes given anonymous function on the server.
     * Internally this serializes the anonymous function into string and sends it to backend via AJAX.
     *
     * @param {string} script - script to be executed on the backend
     * @param {Array.<*>} params - list of parameters to the anonymous function to be send to backend
     * @return {Promise<*>} return value of the executed function on the backend
     */
    this.runOnServer = async (script, params = []) => {
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
        });

        if (ret.success) {
            return ret.executionResult;
        }
        else {
            throw new Error("server error: " + ret.error);
        }
    };

    /**
     * Returns list of notes. If note is missing from cache, it's loaded.
     *
     * This is often used to bulk-fill the cache with notes which would have to be picked one by one
     * otherwise (by e.g. createNoteLink())
     *
     * @param {Array.<string>} noteIds
     * @param {boolean} [silentNotFoundError] - don't report error if the note is not found
     * @return {Promise<Array.<NoteShort>>}
     */
    this.getNotes = async (noteIds, silentNotFoundError = false) => await treeCache.getNotes(noteIds, silentNotFoundError);

    /**
     * Instance name identifies particular Trilium instance. It can be useful for scripts
     * if some action needs to happen on only one specific instance.
     *
     * @return {string}
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
    this.showMessage = infoService.showMessage;

    /**
     * Show error message to the user.
     *
     * @method
     * @param {string} message
     */
    this.showError = infoService.showError;

    /**
     * Refresh tree
     *
     * @method
     * @returns {Promise<void>}
     */
    this.refreshTree = treeService.reload;

    /**
     * Create note link (jQuery object) for given note.
     *
     * @method
     * @param {string} notePath (or noteId)
     * @param {string} [noteTitle] - if not present we'll use note title
     */
    this.createNoteLink = linkService.createNoteLink;
}

export default FrontendScriptApi;