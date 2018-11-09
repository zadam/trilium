import treeService from './tree.js';
import server from './server.js';
import utils from './utils.js';
import infoService from './info.js';
import linkService from './link.js';
import treeCache from './tree_cache.js';
import noteDetailService from './note_detail.js';
import noteTypeService from './note_type.js';

/**
 * This is the main frontend API interface for scripts. It's published in the local "api" object.
 *
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
     * @typedef {Object} ToolbarButtonOptions
     * @property {string} title
     * @property {string} [icon] - name of the JAM icon to be used (e.g. "clock" for "jam-clock" icon)
     * @property {function} action - callback handling the click on the button
     * @property {string} [shortcut] - keyboard shortcut for the button, e.g. "alt+t"
     */

    /**
     * Adds new button the the plugin area.
     *
     * @param {ToolbarButtonOptions} opts
     */
    this.addButtonToToolbar = opts => {
        const buttonId = "toolbar-button-" + opts.title.replace(/[^a-zA-Z0-9]/g, "-");

        const button = $('<button>')
            .addClass("btn btn-sm")
            .click(opts.action);

        if (opts.icon) {
            button.append($("<span>").addClass("jam jam-" + opts.icon))
                  .append("&nbsp;");
        }

        button.append($("<span>").text(opts.title));

        button.attr('id', buttonId);

        if ($("#" + buttonId).replaceWith(button).length === 0) {
            $pluginButtons.append(button);
        }

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
     * @param {Array.<?>} params - list of parameters to the anonymous function to be send to backend
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
     * @param {string[]} noteIds
     * @param {boolean} [silentNotFoundError] - don't report error if the note is not found
     * @return {Promise<NoteShort[]>}
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

    /**
     * @method
     * @returns {string} content of currently loaded note in the editor (HTML, code etc.)
     */
    this.getCurrentNoteContent = noteDetailService.getCurrentNoteContent;

    /**
     * @method
     * @param {function} func - callback called on note change as user is typing (not necessarily tied to save event)
     */
    this.onNoteChange = noteDetailService.onNoteChange;

    /**
     * @method
     * @returns {array} list of default code mime types
     */
    this.getDefaultCodeMimeTypes = noteTypeService.getDefaultCodeMimeTypes;

    /**
     * @method
     * @returns {array} list of currently used code mime types
     */
    this.getCodeMimeTypes = noteTypeService.getCodeMimeTypes;

    /**
     * @method
     * @param {array} types - list of mime types to be used
     */
    this.setCodeMimeTypes = noteTypeService.setCodeMimeTypes;
}

export default FrontendScriptApi;