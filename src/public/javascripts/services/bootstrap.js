import addLinkDialog from '../dialogs/add_link.js';
import jumpToNoteDialog from '../dialogs/jump_to_note.js';
import attributesDialog from '../dialogs/attributes.js';
import noteRevisionsDialog from '../dialogs/note_revisions.js';
import noteSourceDialog from '../dialogs/note_source.js';
import recentChangesDialog from '../dialogs/recent_changes.js';
import optionsDialog from '../dialogs/options.js';
import sqlConsoleDialog from '../dialogs/sql_console.js';
import markdownImportDialog from '../dialogs/markdown_import.js';
import exportDialog from '../dialogs/export.js';

import cloning from './cloning.js';
import contextMenu from './tree_context_menu.js';
import dragAndDropSetup from './drag_and_drop.js';
import exportService from './export.js';
import link from './link.js';
import messagingService from './messaging.js';
import noteDetailService from './note_detail.js';
import noteType from './note_type.js';
import protected_session from './protected_session.js';
import searchNotesService from './search_notes.js';
import FrontendScriptApi from './frontend_script_api.js';
import ScriptContext from './script_context.js';
import sync from './sync.js';
import treeService from './tree.js';
import treeChanges from './branches.js';
import treeUtils from './tree_utils.js';
import utils from './utils.js';
import server from './server.js';
import entrypoints from './entrypoints.js';
import tooltip from './tooltip.js';
import bundle from "./bundle.js";
import treeCache from "./tree_cache.js";
import libraryLoader from "./library_loader.js";

// required for CKEditor image upload plugin
window.glob.getCurrentNode = treeService.getCurrentNode;
window.glob.getHeaders = server.getHeaders;
window.glob.showAddLinkDialog = addLinkDialog.showDialog;
// this is required by CKEditor when uploading images
window.glob.noteChanged = noteDetailService.noteChanged;
window.glob.refreshTree = treeService.reload;

// required for ESLint plugin
window.glob.getCurrentNote = noteDetailService.getCurrentNote;
window.glob.requireLibrary = libraryLoader.requireLibrary;
window.glob.ESLINT = libraryLoader.ESLINT;

window.onerror = function (msg, url, lineNo, columnNo, error) {
    const string = msg.toLowerCase();

    let message = "Uncaught error: ";

    if (string.includes("Cannot read property 'defaultView' of undefined")) {
        // ignore this specific error which is very common but we don't know where it comes from
        // and it seems to be harmless
        return true;
    }
    else if (string.includes("script error")) {
        message += 'No details available';
    }
    else {
        message += [
            'Message: ' + msg,
            'URL: ' + url,
            'Line: ' + lineNo,
            'Column: ' + columnNo,
            'Error object: ' + JSON.stringify(error)
        ].join(' - ');
    }

    messagingService.logError(message);

    return false;
};

const wikiBaseUrl = "https://github.com/zadam/trilium/wiki/";

$(document).on("click", "button[data-help-page]", e => {
    const $button = $(e.target);

    window.open(wikiBaseUrl + $button.attr("data-help-page"), '_blank');
});

$("#logout-button").toggle(!utils.isElectron());

if (utils.isElectron()) {
    require('electron').ipcRenderer.on('create-day-sub-note', async function(event, parentNoteId) {
        // this might occur when day note had to be created
        if (!await treeCache.getNote(parentNoteId)) {
            await treeService.reload();
        }

        await treeService.activateNote(parentNoteId);

        setTimeout(async () => {
            const parentNode = treeService.getCurrentNode();

            const {note} = await treeService.createNote(parentNode, parentNode.data.noteId, 'into', parentNode.data.isProtected);

            await treeService.activateNote(note.noteId);

        }, 500);
    });
}

function exec(cmd) {
    document.execCommand(cmd);

    return false;
}

if (utils.isElectron() && utils.isMac()) {
    utils.bindShortcut('ctrl+c', () => exec("copy"));
    utils.bindShortcut('ctrl+v', () => exec('paste'));
    utils.bindShortcut('ctrl+x', () => exec('cut'));
    utils.bindShortcut('ctrl+a', () => exec('selectAll'));
    utils.bindShortcut('ctrl+z', () => exec('undo'));
    utils.bindShortcut('ctrl+y', () => exec('redo'));
}

$("#export-note-button").click(function () {
    if ($(this).hasClass("disabled")) {
        return;
    }

    exportDialog.showDialog('single');
});

treeService.showTree();

entrypoints.registerEntrypoints();

tooltip.setupTooltip();

bundle.executeStartupBundles();
