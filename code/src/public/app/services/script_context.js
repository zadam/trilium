import FrontendScriptApi from './frontend_script_api.js';
import utils from './utils.js';
import froca from './froca.js';

async function ScriptContext(startNoteId, allNoteIds, originEntity = null, $container = null) {
    const modules = {};

    await froca.initializedPromise;

    const startNote = await froca.getNote(startNoteId);
    const allNotes = await froca.getNotes(allNoteIds);

    return {
        modules: modules,
        notes: utils.toObject(allNotes, note => [note.noteId, note]),
        apis: utils.toObject(allNotes, note => [note.noteId, new FrontendScriptApi(startNote, note, originEntity, $container)]),
        require: moduleNoteIds => {
            return moduleName => {
                const candidates = allNotes.filter(note => moduleNoteIds.includes(note.noteId));
                const note = candidates.find(c => c.title === moduleName);

                if (!note) {
                    throw new Error(`Could not find module note ${moduleName}`);
                }

                return modules[note.noteId].exports;
            }
        }
    };
}

export default ScriptContext;