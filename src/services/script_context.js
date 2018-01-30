const log = require('./log');
const protected_session = require('./protected_session');
const notes = require('./notes');
const attributes = require('./attributes');
const date_notes = require('./date_notes');
const sql = require('./sql');
const sync_table = require('./sync_table');
const Repository = require('./repository');

function ScriptContext(noteId, dataKey) {
    this.scriptNoteId = noteId;
    this.dataKey = protected_session.getDataKey(dataKey);
    this.repository = new Repository(dataKey);

    function serializePayload(payload) {
        return JSON.stringify(payload, null, '\t');
    }

    this.getNoteById = async function(noteId) {
        return this.repository.getNote(noteId);
    };

    this.getNotesWithAttribute = async function (attrName, attrValue) {
        return await attributes.getNotesWithAttribute(this.dataKey, attrName, attrValue);
    };

    this.getNoteWithAttribute = async function (attrName, attrValue) {
        const notes = this.getNotesWithAttribute(attrName, attrValue);

        return notes.length > 0 ? notes[0] : null;
    };

    this.createNote = async function (parentNoteId, name, payload, extraOptions = {}) {
        const note = {
            title: name,
            content: extraOptions.json ? serializePayload(payload) : payload,
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

        const noteId = (await notes.createNewNote(parentNoteId, note)).noteId;

        if (extraOptions.attributes) {
            for (const attrName in extraOptions.attributes) {
                await attributes.createAttribute(noteId, attrName, extraOptions.attributes[attrName]);
            }
        }

        return noteId;
    };

    this.updateNote = async function (note) {
        if (note.isJson()) {
            note.content = serializePayload(note.jsonContent);
        }

        delete note.jsonContent;

        if (note.isProtected) {
            protected_session.encryptNote(this.dataKey, note);
        }

        await sql.replace("notes", note);

        await sync_table.addNoteSync(note.noteId);
    };

    this.log = function(message) {
        log.info(`Script ${this.scriptNoteId}: ${message}`);
    };

    this.getDateNoteId = date_notes.getDateNoteId;
}

module.exports = ScriptContext;