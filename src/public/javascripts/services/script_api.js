import treeService from './tree.js';
import server from './server.js';
import utils from './utils.js';
import infoService from './info.js';

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
        getInstanceName: () => window.glob.instanceName,
        runOnServer,
        formatDateISO: utils.formatDateISO,
        parseDate: utils.parseDate,
        showMessage: infoService.showMessage,
        showError: infoService.showError,
        reloadTree: treeService.reload
    }
}

export default ScriptApi;