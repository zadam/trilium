const log = require('./log');
const noteService = require('./notes');
const sql = require('./sql');
const utils = require('./utils');
const attributeService = require('./attributes');
const dateNoteService = require('./date_notes');
const treeService = require('./tree');
const config = require('./config');
const repository = require('./repository');
const axios = require('axios');
const dayjs = require('dayjs');
const cloningService = require('./cloning');
const messagingService = require('./messaging');
const appInfo = require('./app_info');
const searchService = require('./search');

/**
 * This is the main backend API interface for scripts. It's published in the local "api" object.
 *
 * @constructor
 * @hideconstructor
 */
function BackendScriptApi(currentNote, apiParams) {
    /** @property {Note} note where script started executing */
    this.startNote = apiParams.startNote;
    /** @property {Note} note where script is currently executing. Don't mix this up with concept of active note */
    this.currentNote = currentNote;
    /** @property {Entity} entity whose event triggered this executions */
    this.originEntity = apiParams.originEntity;

    for (const key in apiParams) {
        this[key] = apiParams[key];
    }

    this.axios = axios;
    this.dayjs = dayjs;

    this.utils = {
        unescapeHtml: utils.unescapeHtml
    };

    /**
     * Instance name identifies particular Trilium instance. It can be useful for scripts
     * if some action needs to happen on only one specific instance.
     *
     * @returns {string|null}
     */
    this.getInstanceName = () => config.General ? config.General.instanceName : null;

    /**
     * @method
     * @param {string} noteId
     * @returns {Promise<Note|null>}
     */
    this.getNote = repository.getNote;

    /**
     * @method
     * @param {string} branchId
     * @returns {Promise<Branch|null>}
     */
    this.getBranch = repository.getBranch;

    /**
     * @method
     * @param {string} attributeId
     * @returns {Promise<Attribute|null>}
     */
    this.getAttribute = repository.getAttribute;

    /**
     * @method
     * @param {string} imageId
     * @returns {Promise<Image|null>}
     */
    this.getImage = repository.getImage;

    /**
     * Retrieves first entity from the SQL's result set.
     *
     * @method
     * @param {string} SQL query
     * @param {Array.<?>} array of params
     * @returns {Promise<Entity|null>}
     */
    this.getEntity = repository.getEntity;

    /**
     * @method
     * @param {string} SQL query
     * @param {Array.<?>} array of params
     * @returns {Promise<Entity[]>}
     */
    this.getEntities = repository.getEntities;

    /**
     * This is a powerful search method - you can search by attributes and their values, e.g.:
     * "@dateModified =* MONTH AND @log". See full documentation for all options at: https://github.com/zadam/trilium/wiki/Search
     *
     * @method
     * @param {string} searchString
     * @returns {Promise<Note[]>}
     */
    this.searchForNotes = searchService.searchForNotes;

    /**
     * This is a powerful search method - you can search by attributes and their values, e.g.:
     * "@dateModified =* MONTH AND @log". See full documentation for all options at: https://github.com/zadam/trilium/wiki/Search
     *
     * @method
     * @param {string} searchString
     * @returns {Promise<Note|null>}
     */
    this.searchForNote = async searchString => {
        const notes = await searchService.searchForNotes(searchString);

        return notes.length > 0 ? notes[0] : null;
    };

    /**
     * Retrieves notes with given label name & value
     *
     * @method
     * @param {string} name - attribute name
     * @param {string} [value] - attribute value
     * @returns {Promise<Note[]>}
     */
    this.getNotesWithLabel = attributeService.getNotesWithLabel;

    /**
     * Retrieves first note with given label name & value
     *
     * @method
     * @param {string} name - attribute name
     * @param {string} [value] - attribute value
     * @returns {Promise<Note|null>}
     */
    this.getNoteWithLabel = attributeService.getNoteWithLabel;

    /**
     * If there's no branch between note and parent note, create one. Otherwise do nothing.
     *
     * @method
     * @param {string} noteId
     * @param {string} parentNoteId
     * @param {string} prefix - if branch will be create between note and parent note, set this prefix
     * @returns {Promise<void>}
     */
    this.ensureNoteIsPresentInParent = cloningService.ensureNoteIsPresentInParent;

    /**
     * If there's a branch between note and parent note, remove it. Otherwise do nothing.
     *
     * @method
     * @param {string} noteId
     * @param {string} parentNoteId
     * @returns {Promise<void>}
     */
    this.ensureNoteIsAbsentFromParent = cloningService.ensureNoteIsAbsentFromParent;

    /**
     * Based on the value, either create or remove branch between note and parent note.
     *
     * @method
     * @param {boolean} present - true if we want the branch to exist, false if we want it gone
     * @param {string} noteId
     * @param {string} parentNoteId
     * @param {string} prefix - if branch will be create between note and parent note, set this prefix
     * @returns {Promise<void>}
     */
    this.toggleNoteInParent = cloningService.toggleNoteInParent;

    /**
     * @typedef {object} CreateNoteAttribute
     * @property {string} type - attribute type - label, relation etc.
     * @property {string} name - attribute name
     * @property {string} [value] - attribute value
     */

    /**
     * @typedef {object} CreateNoteExtraOptions
     * @property {boolean} [json=false] - should the note be JSON
     * @property {boolean} [isProtected=false] - should the note be protected
     * @property {string} [type='text'] - note type
     * @property {string} [mime='text/html'] - MIME type of the note
     * @property {CreateNoteAttribute[]} [attributes=[]] - attributes to be created for this note
     */

    /**
     * @method
     *
     * @param {string} parentNoteId - create new note under this parent
     * @param {string} title
     * @param {string} [content=""]
     * @param {CreateNoteExtraOptions} [extraOptions={}]
     * @returns {Promise<{note: Note, branch: Branch}>} object contains newly created entities note and branch
     */
    this.createNote = noteService.createNote;

    /**
     * Creates new note according to given params and force all connected clients to refresh their tree.
     *
     * @method
     *
     * @param {string} parentNoteId - create new note under this parent
     * @param {string} title
     * @param {string} [content=""]
     * @param {CreateNoteExtraOptions} [extraOptions={}]
     * @returns {Promise<{note: Note, branch: Branch}>} object contains newly created entities note and branch
     */
    this.createNoteAndRefresh = async function(parentNoteId, title, content, extraOptions) {
        await noteService.createNote(parentNoteId, title, content, extraOptions);

        messagingService.refreshTree();
    };

    /**
     * Log given message to trilium logs.
     *
     * @param message
     */
    this.log = message => log.info(`Script "${currentNote.title}" (${currentNote.noteId}): ${message}`);

    /**
     * Returns root note of the calendar.
     *
     * @method
     * @returns {Promise<Note|null>}
     */
    this.getRootCalendarNote = dateNoteService.getRootCalendarNote;

    /**
     * Returns day note for given date. If such note doesn't exist, it is created.
     *
     * @method
     * @param {string} date in YYYY-MM-DD format
     * @returns {Promise<Note|null>}
     */
    this.getDateNote = dateNoteService.getDateNote;

    /**
     * Returns note for the first date of the week of the given date.
     *
     * @method
     * @param {string} date in YYYY-MM-DD format
     * @param {object} options - "startOfTheWeek" - either "monday" (default) or "sunday"
     * @returns {Promise<Note|null>}
     */
    this.getWeekNote = dateNoteService.getWeekNote;

    /**
     * Returns month note for given date. If such note doesn't exist, it is created.
     *
     * @method
     * @param {string} date in YYYY-MM format
     * @returns {Promise<Note|null>}
     */
    this.getMonthNote = dateNoteService.getMonthNote;

    /**
     * Returns year note for given year. If such note doesn't exist, it is created.
     *
     * @method
     * @param {string} year in YYYY format
     * @returns {Promise<Note|null>}
     */
    this.getYearNote = dateNoteService.getYearNote;

    /**
     * @method
     * @param {string} parentNoteId - this note's child notes will be sorted
     * @returns Promise<void>
     */
    this.sortNotesAlphabetically = treeService.sortNotesAlphabetically;

    /**
     * This method finds note by its noteId and prefix and either sets it to the given parentNoteId
     * or removes the branch (if parentNoteId is not given).
     *
     * This method looks similar to toggleNoteInParent() but differs because we're looking up branch by prefix.
     *
     * @method
     * @param {string} noteId
     * @param {string} prefix
     * @param {string} [parentNoteId]
     */
    this.setNoteToParent = treeService.setNoteToParent;

    /**
     * This functions wraps code which is supposed to be running in transaction. If transaction already
     * exists, then we'll use that transaction.
     *
     * This method is required only when script has label manualTransactionHandling, all other scripts are
     * transactional by default.
     *
     * @method
     * @param {function} func
     * @returns {Promise<?>} result of func callback
     */
    this.transactional = sql.transactional;

    this.sql = sql;

    /**
     * Trigger tree refresh in all connected clients. This is required when some tree change happens in
     * the backend.
     *
     * @returns {Promise<void>}
     */
    this.refreshTree = messagingService.refreshTree;

    /**
     * @return {{syncVersion, appVersion, buildRevision, dbVersion, dataDirectory, buildDate}|*} - object representing basic info about running Trilium version
     */
    this.getAppInfo = () => appInfo
}

module.exports = BackendScriptApi;