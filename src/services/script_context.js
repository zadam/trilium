const utils = require('./utils');
const BackendScriptApi = require('./backend_script_api');

function ScriptContext(allNotes, apiParams = {}) {
    this.modules = {};
    this.notes = utils.toObject(allNotes, note => [note.noteId, note]);
    this.apis = utils.toObject(allNotes, note => [note.noteId, new BackendScriptApi(note, apiParams)]);
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

module.exports = ScriptContext;