const log = require('./log');
const protected_session = require('./protected_session');
const notes = require('./notes');
const attributes = require('./attributes');
const date_notes = require('./date_notes');
const Repository = require('./repository');

function ScriptContext(noteId, dataKey) {
    this.dataKey = protected_session.getDataKey(dataKey);
    this.repository = new Repository(dataKey);

    this.getNoteById = async function(noteId) {
        return this.repository.getNote(noteId);
    };

    this.getNotesWithAttribute = async function (attrName, attrValue) {
        return await attributes.getNotesWithAttribute(this.dataKey, attrName, attrValue);
    };

    this.getNoteWithAttribute = async function (attrName, attrValue) {
        const notes = await this.getNotesWithAttribute(attrName, attrValue);

        return notes.length > 0 ? notes[0] : null;
    };

    this.createNote = async function (parentNoteId, title, content = "", extraOptions = {}) {
        const note = {
            title: title,
            content: extraOptions.json ? JSON.stringify(content, null, '\t') : content,
            target: 'into',
            isProtected: extraOptions.isProtected !== undefined ? extraOptions.isProtected : false,
            type: extraOptions.type,
            mime: extraOptions.mime
        };

        if (extraOptions.json) {
            note.type = "code";
            note.mime = "application/json";
        }

        if (!note.type) {
            note.type = "text";
            note.mime = "text/html";
        }

        const noteId = (await notes.createNewNote(parentNoteId, note, this.dataKey)).noteId;

        if (extraOptions.attributes) {
            for (const attrName in extraOptions.attributes) {
                await attributes.createAttribute(noteId, attrName, extraOptions.attributes[attrName]);
            }
        }

        return noteId;
    };

    this.createAttribute = attributes.createAttribute;

    this.updateEntity = this.repository.updateEntity;

    this.log = message => log.info(`Script: ${message}`);

    this.getRootCalendarNoteId = date_notes.getRootCalendarNoteId;
    this.getDateNoteId = date_notes.getDateNoteId;
}

module.exports = ScriptContext;