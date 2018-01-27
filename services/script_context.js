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
        if (note.type === "code" && note.mime === "application/json") {
            note.payload = JSON.parse(note.note_text);
        }
    }

    this.getNoteById = async function(noteId) {
        const note = await notes.getNoteById(noteId, this.dataKey);

        deserializePayload(note);

        return note;
    };

    this.getNoteWithAttribute = async function (attrName, attrValue) {
        const note = await attributes.getNoteWithAttribute(this.dataKey, attrName, attrValue);

        deserializePayload(note);

        return note;
    };

    this.createNote = async function (parentNoteId, name, payload, extraOptions = {}) {
        const note = {
            note_title: name,
            note_text: extraOptions.json ? JSON.stringify(payload) : payload,
            target: 'into',
            is_protected: extraOptions.isProtected !== undefined ? extraOptions.isProtected : false,
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
            note.note_text = JSON.stringify(note.payload);
        }

        log.info("new note text: ", note.note_text);

        delete note.payload;

        if (note.is_protected) {
            protected_session.encryptNote(this.dataKey, note);
        }

        await sql.replace("notes", note);

        await sync_table.addNoteSync(note.note_id);
    };

    this.log = function(message) {
        log.info(`Script ${this.scriptNoteId}: ${message}`);
    };

    this.getDateNoteId = date_notes.getDateNoteId;
}

module.exports = ScriptContext;