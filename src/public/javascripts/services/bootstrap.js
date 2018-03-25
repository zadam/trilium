import addLink from '../dialogs/add_link.js';
import editTreePrefix from '../dialogs/edit_tree_prefix.js';
import eventLog from '../dialogs/event_log.js';
import jumpToNote from '../dialogs/jump_to_note.js';
import labelsDialog from '../dialogs/labels.js';
import noteHistory from '../dialogs/note_history.js';
import noteSource from '../dialogs/note_source.js';
import recentChanges from '../dialogs/recent_changes.js';
import recentNotes from '../dialogs/recent_notes.js';
import settings from '../dialogs/settings.js';
import sqlConsole from '../dialogs/sql_console.js';

import cloning from './cloning.js';
import contextMenu from './context_menu.js';
import dragAndDropSetup from './drag_and_drop.js';
import exportService from './export.js';
import link from './link.js';
import messaging from './messaging.js';
import noteDetail from './note_detail.js';
import noteType from './note_type.js';
import protected_session from './protected_session.js';
import ScriptApi from './script_api.js';
import ScriptContext from './script_context.js';
import sync from './sync.js';
import treeChanges from './tree_changes.js';
import treeUtils from './tree_utils.js';
import utils from './utils.js';

import searchTreeService from './search_tree.js';
import './init.js';
import treeService from './tree_service.js';
const $toggleSearchButton = $("#toggle-search-button");

$toggleSearchButton.click(searchTreeService.toggleSearch);
bindShortcut('ctrl+s', searchTreeService.toggleSearch);

function bindShortcut(keyboardShortcut, handler) {
    $(document).bind('keydown', keyboardShortcut, e => {
        handler();

        e.preventDefault();
    });
}