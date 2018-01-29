const log = require('./log');
const protected_session = require('./protected_session');
const notes = require('./notes');
const attributes = require('./attributes');
const date_notes = require('./date_notes');
const sql = require('./sql');
const sync_table = require('./sync_table');

function ScriptContext(noteId, dataKey) {
    this.scriptNoteId = noteId;
    this.dataKey = protected_session.getDataKey(dataKey);

    function deserializePayload(note) {
        if (note && note.type === "code" && note.mime === "application/json") {
            note.payload = JSON.parse(note.content);
        }
    }

    function serializePayload(payload) {
        return JSON.stringify(payload, null, '\t');
    }

    this.getNoteById = async function(noteId) {
        const note = await notes.getNoteById(noteId, this.dataKey);

        deserializePayload(note);

        return note;
    };

    this.getNotesWithAttribute = async function (attrName, attrValue) {
        const notes = await attributes.getNotesWithAttribute(this.dataKey, attrName, attrValue);

        for (const note of notes) {
            deserializePayload(note);
        }

        return notes;
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
            note.mime = "";
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
        if (note.type === 'code' && note.mime === 'application/json') {
            note.content = serializePayload(note.payload);
        }

        log.info("new note text: ", note.content);

        delete note.payload;

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