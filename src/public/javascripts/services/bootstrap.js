import addLinkDialog from '../dialogs/add_link.js';
import jumpToNoteDialog from '../dialogs/jump_to_note.js';
import labelsDialog from '../dialogs/labels.js';
import noteRevisionsDialog from '../dialogs/note_revisions.js';
import noteSourceDialog from '../dialogs/note_source.js';
import recentChangesDialog from '../dialogs/recent_changes.js';
import recentNotesDialog from '../dialogs/recent_notes.js';
import settingsDialog from '../dialogs/settings.js';
import sqlConsoleDialog from '../dialogs/sql_console.js';

import cloning from './cloning.js';
import contextMenu from './context_menu.js';
import dragAndDropSetup from './drag_and_drop.js';
import exportService from './export.js';
import link from './link.js';
import messaging from './messaging.js';
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

import './init.js';

// required for CKEditor image upload plugin
window.glob.getCurrentNode = treeService.getCurrentNode;
window.glob.getHeaders = server.getHeaders;

// required for ESLint plugin
window.glob.getCurrentNote = noteDetailService.getCurrentNote;
window.glob.requireLibrary = utils.requireLibrary;
window.glob.ESLINT = utils.ESLINT;

utils.bindShortcut('ctrl+l', addLinkDialog.showDialog);

$("#jump-to-note-button").click(jumpToNoteDialog.showDialog);
utils.bindShortcut('ctrl+j', jumpToNoteDialog.showDialog);

$("#show-note-revisions-button").click(noteRevisionsDialog.showCurrentNoteRevisions);

$("#show-source-button").click(noteSourceDialog.showDialog);
utils.bindShortcut('ctrl+u', noteSourceDialog.showDialog);

$("#recent-changes-button").click(recentChangesDialog.showDialog);

$("#recent-notes-button").click(recentNotesDialog.showDialog);
utils.bindShortcut('ctrl+e', recentNotesDialog.showDialog);

$("#toggle-search-button").click(searchTreeService.toggleSearch);
utils.bindShortcut('ctrl+s', searchTreeService.toggleSearch);

$(".show-labels-button").click(labelsDialog.showDialog);
utils.bindShortcut('alt+l', labelsDialog.showDialog);

$("#settings-button").click(settingsDialog.showDialog);

utils.bindShortcut('alt+o', sqlConsoleDialog.showDialog);

if (utils.isElectron()) {
    utils.bindShortcut('alt+left', window.history.back);
    utils.bindShortcut('alt+right', window.history.forward);
}