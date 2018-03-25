function ScriptContext(startNote, allNotes) {
    const modules = {};

    return {
        modules: modules,
        notes: utils.toObject(allNotes, note => [note.noteId, note]),
        apis: utils.toObject(allNotes, note => [note.noteId, ScriptApi(startNote, note)]),
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

function ScriptApi(startNote, currentNote) {
    const $pluginButtons = $("#plugin-buttons");

    async function activateNote(notePath) {
        await treeService.activateNode(notePath);
    }

    function addButtonToToolbar(buttonId, button) {
        $("#" + buttonId).remove();

        button.attr('id', buttonId);

        $pluginButtons.append(button);
    }

    function prepareParams(params) {
        if (!params) {
            return params;
        }

        return params.map(p => {
            if (typeof p === "function") {
                return "!@#Function: " + p.toString();
            }
            else {
                return p;
            }
        });
    }

    async function runOnServer(script, params = []) {
        if (typeof script === "function") {
            script = script.toString();
        }

        const ret = await server.post('script/exec', {
            script: script,
            params: prepareParams(params),
            startNoteId: startNote.noteId,
            currentNoteId: currentNote.noteId
        });

        return ret.executionResult;
    }

    return {
        startNote: startNote,
        currentNote: currentNote,
        addButtonToToolbar,
        activateNote,
        getInstanceName: treeService.getInstanceName,
        runOnServer
    }
}