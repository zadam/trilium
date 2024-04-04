import utils = require('./utils');
import BackendScriptApi = require('./backend_script_api');
import BNote = require('../becca/entities/bnote');
import { ApiParams } from './backend_script_api_interface';

type Module = {
    exports: any[];
};

class ScriptContext {
    modules: Record<string, Module>;
    notes: {};
    apis: {};
    allNotes: BNote[];
    
    constructor(allNotes: BNote[], apiParams: ApiParams) {
        this.allNotes = allNotes;
        this.modules = {};
        this.notes = utils.toObject(allNotes, note => [note.noteId, note]);
        this.apis = utils.toObject(allNotes, note => [note.noteId, new BackendScriptApi(note, apiParams)]);
    }

    require(moduleNoteIds: string[]) {
        return (moduleName: string) => {
            const candidates = this.allNotes.filter(note => moduleNoteIds.includes(note.noteId));
            const note = candidates.find(c => c.title === moduleName);

            if (!note) {
                return require(moduleName);
            }

            return this.modules[note.noteId].exports;
        }
    };
}

export = ScriptContext;
