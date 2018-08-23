import FrontendScriptApi from './frontend_script_api.js';
import utils from './utils.js';

function ScriptContext(startNote, allNotes, originEntity = null) {
    const modules = {};

    return {
        modules: modules,
        notes: utils.toObject(allNotes, note => [note.noteId, note]),
        apis: utils.toObject(allNotes, note => [note.noteId, new FrontendScriptApi(startNote, note, originEntity)]),
        require: moduleNoteIds => {
            return moduleName => {
                const candidates = allNotes.filter(note => moduleNoteIds.includes(note.noteId));
                const note = candidates.find(c => c.title === moduleName);

                if (!note) {
                    throw new Error("Could not find module note " + moduleName);
                }

                return modules[note.noteId].exports;
            }
        }
    };
}

export default ScriptContext;