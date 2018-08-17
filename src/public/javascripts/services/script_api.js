import treeService from './tree.js';
import server from './server.js';
import utils from './utils.js';
import infoService from './info.js';
import linkService from './link.js';
import treeCache from './tree_cache.js';

function ScriptApi(startNote, currentNote, originEntity = null) {
    const $pluginButtons = $("#plugin-buttons");

    async function activateNote(notePath) {
        await treeService.activateNode(notePath);
    }

    async function activateNewNote(notePath) {
        await treeService.reload();

        await treeService.activateNode(notePath, true);
    }

    function addButtonToToolbar(opts) {
        const buttonId = "toolbar-button-" + opts.title.replace(/[^a-zA-Z0-9]/g, "-");

        $("#" + buttonId).remove();

        const icon = $("<span>")
            .addClass("ui-icon ui-icon-" + opts.icon);

        const button = $('<button>')
            .addClass("btn btn-xs")
            .click(opts.action)
            .append(icon)
            .append($("<span>").text(opts.title));

        button.attr('id', buttonId);

        $pluginButtons.append(button);

        if (opts.shortcut) {
            $(document).bind('keydown', opts.shortcut, opts.action);

            button.attr("title", "Shortcut " + opts.shortcut);
        }
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
            currentNoteId: currentNote.noteId,
            originEntityName: "notes", // currently there's no other entity on frontend which can trigger event
            originEntityId: originEntity ? originEntity.noteId : null
        });

        if (ret.success) {
            return ret.executionResult;
        }
        else {
            throw new Error("server error: " + ret.error);
        }
    }

    return {
        startNote: startNote,
        currentNote: currentNote,
        originEntity: originEntity,
        // needs to have the longform, can't be shortened!
        // used also to load many rows to cache before further code starts using them
        getNotes: async (noteIds, silentNotFoundError = false) => await treeCache.getNotes(noteIds, silentNotFoundError),
        addButtonToToolbar,
        activateNote,
        activateNewNote,
        getInstanceName: () => window.glob.instanceName,
        runOnServer,
        formatDateISO: utils.formatDateISO,
        parseDate: utils.parseDate,
        showMessage: infoService.showMessage,
        showError: infoService.showError,
        reloadTree: treeService.reload, // deprecated
        refreshTree: treeService.reload,
        createNoteLink: linkService.createNoteLink
    }
}

export default ScriptApi;