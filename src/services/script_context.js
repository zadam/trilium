const log = require('./log');
const protected_session = require('./protected_session');
const notes = require('./notes');
const sql = require('./sql');
const utils = require('./utils');
const attributes = require('./attributes');
const date_notes = require('./date_notes');
const config = require('./config');
const Repository = require('./repository');
const axios = require('axios');

function ScriptContext(dataKey, startNote, allNotes) {
    dataKey = protected_session.getDataKey(dataKey);
    const repository = new Repository(dataKey);

    this.__startNote = startNote;
    this.__notes = utils.toObject(allNotes, note => [note.noteId, note]);
    this.__modules = {};

    this.axios = axios;

    this.utils = {
        unescapeHtml: utils.unescapeHtml,
        isoDateTimeStr: utils.dateStr
    };

    this.getInstanceName = () => config.General ? config.General.instanceName : null;

    this.getNoteById = async function(noteId) {
        return repository.getNote(noteId);
    };

    this.getNotesWithAttribute = async function (attrName, attrValue) {
        return await attributes.getNotesWithAttribute(repository, attrName, attrValue);
    };

    this.getNoteWithAttribute = async function (attrName, attrValue) {
        const notes = await this.getNotesWithAttribute(attrName, attrValue);

        return notes.length > 0 ? notes[0] : null;
    };

    this.createNote = async function(parentNoteId, title, content = "", extraOptions = {}) {
        extraOptions.dataKey = dataKey;

        return await notes.createNote(parentNoteId, title, content, extraOptions);
    };

    this.createAttribute = attributes.createAttribute;

    this.updateEntity = repository.updateEntity;

    this.log = message => log.info(`Script: ${message}`);

    this.getRootCalendarNoteId = date_notes.getRootCalendarNoteId;
    this.getDateNoteId = date_notes.getDateNoteId;

    this.transaction = sql.doInTransaction;
}

module.exports = ScriptContext;