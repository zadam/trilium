const log = require('./log');
const noteService = require('./notes');
const sql = require('./sql');
const utils = require('./utils');
const labelService = require('./labels');
const dateNoteService = require('./date_notes');
const config = require('./config');
const repository = require('./repository');
const axios = require('axios');

function ScriptContext(startNote, allNotes) {
    this.modules = {};
    this.notes = utils.toObject(allNotes, note => [note.noteId, note]);
    this.apis = utils.toObject(allNotes, note => [note.noteId, new ScriptApi(startNote, note)]);
    this.require = moduleNoteIds => {
        return moduleName => {
            const candidates = allNotes.filter(note => moduleNoteIds.includes(note.noteId));
            const note = candidates.find(c => c.title === moduleName);

            if (!note) {
                throw new Error("Could not find module note " + moduleName);
            }

            return this.modules[note.noteId].exports;
        }
    };
}

function ScriptApi(startNote, currentNote) {
    this.startNote = startNote;
    this.currentNote = currentNote;

    this.axios = axios;

    this.utils = {
        unescapeHtml: utils.unescapeHtml,
        isoDateTimeStr: utils.dateStr,
        isoDateStr: date => utils.dateStr(date).substr(0, 10)
    };

    this.getInstanceName = () => config.General ? config.General.instanceName : null;

    this.getNote = repository.getNote;
    this.getBranch = repository.getBranch;
    this.getLabel = repository.getLabel;
    this.getImage = repository.getImage;
    this.getEntity = repository.getEntity;
    this.getEntities = repository.getEntities;

    this.getNotesWithLabel = async function (labelName, labelValue) {
        return await labelService.getNotesWithLabel(labelName, labelValue);
    };

    this.getNoteWithLabel = async function (labelName, labelValue) {
        const notes = await this.getNotesWithLabel(labelName, labelValue);

        return notes.length > 0 ? notes[0] : null;
    };

    this.createNote = async function(parentNoteId, title, content = "", extraOptions = {}) {
        return await noteService.createNote(parentNoteId, title, content, extraOptions);
    };

    this.createLabel = labelService.createLabel;

    this.log = message => log.info(`Script ${currentNote.noteId}: ${message}`);

    this.getRootCalendarNoteId = dateNoteService.getRootCalendarNoteId;
    this.getDateNoteId = dateNoteService.getDateNoteId;

    this.transaction = sql.doInTransaction;
}

module.exports = ScriptContext;