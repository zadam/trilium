import addLinkDialog from '../dialogs/add_link.js';
import jumpToNoteDialog from '../dialogs/jump_to_note.js';
import labelsDialog from '../dialogs/labels.js';
import noteRevisionsDialog from '../dialogs/note_revisions.js';
import noteSourceDialog from '../dialogs/note_source.js';
import recentChangesDialog from '../dialogs/recent_changes.js';
import recentNotesDialog from '../dialogs/recent_notes.js';
import optionsDialog from '../dialogs/options.js';
import sqlConsoleDialog from '../dialogs/sql_console.js';

import cloning from './cloning.js';
import contextMenu from './context_menu.js';
import dragAndDropSetup from './drag_and_drop.js';
import exportService from './export.js';
import link from './link.js';
import messagingService from './messaging.js';
import noteDetailService from './note_detail.js';
import noteType from './note_type.js';
import protected_session from './protected_session.js';
import searchTreeService from './search_tree.js';
import ScriptApi from './script_api.js';
import ScriptContext from './script_context.js';
import sync from './sync.js';
import treeService from './tree.js';
import treeChanges from './tree_changes.js';
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

// required for ESLint plugin
window.glob.getCurrentNote = noteDetailService.getCurrentNote;
window.glob.requireLibrary = libraryLoader.requireLibrary;
window.glob.ESLINT = libraryLoader.ESLINT;

window.onerror = function (msg, url, lineNo, columnNo, error) {
    const string = msg.toLowerCase();

    let message = "Uncaught error: ";

    if (string.indexOf("script error") > -1){
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

$("#logout-button").toggle(!utils.isElectron());

if (utils.isElectron()) {
    require('electron').ipcRenderer.on('create-day-sub-note', async function(event, parentNoteId) {
        // this might occur when day note had to be created
        if (!await treeCache.getNote(parentNoteId)) {
            await treeService.reload();
        }

        await treeService.activateNode(parentNoteId);

        setTimeout(() => {
            const node = treeService.getCurrentNode();

            treeService.createNote(node, node.data.noteId, 'into', node.data.isProtected);
        }, 500);
    });
}

treeService.showTree();

entrypoints.registerEntrypoints();

tooltip.setupTooltip();

$(document).ready(bundle.executeStartupBundles);