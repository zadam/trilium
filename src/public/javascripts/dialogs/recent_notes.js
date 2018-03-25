"use strict";

import treeService from '../note_tree.js';
import server from '../server.js';
import messaging from '../messaging.js';

const $showDialogButton = $("#recent-notes-button");
const $dialog = $("#recent-notes-dialog");
const $searchInput = $('#recent-notes-search-input');

// list of recent note paths
let list = [];

async function reload() {
    const result = await server.get('recent-notes');

    list = result.map(r => r.notePath);
}

function addRecentNote(branchId, notePath) {
    setTimeout(async () => {
        // we include the note into recent list only if the user stayed on the note at least 5 seconds
        if (notePath && notePath === treeService.getCurrentNotePath()) {
            const result = await server.put('recent-notes/' + branchId + '/' + encodeURIComponent(notePath));

            list = result.map(r => r.notePath);
        }
    }, 1500);
}

function showDialog() {
    glob.activeDialog = $dialog;

    $dialog.dialog({
        modal: true,
        width: 800,
        height: 100,
        position: { my: "center top+100", at: "top", of: window }
    });

    $searchInput.val('');

    // remove the current note
    const recNotes = list.filter(note => note !== treeService.getCurrentNotePath());

    $searchInput.autocomplete({
        source: recNotes.map(notePath => {
            let noteTitle;

            try {
                noteTitle = treeService.getNotePathTitle(notePath);
            }
            catch (e) {
                noteTitle = "[error - can't find note title]";

                messaging.logError("Could not find title for notePath=" + notePath + ", stack=" + e.stack);
            }

            return {
                label: noteTitle,
                value: notePath
            }
        }),
        minLength: 0,
        autoFocus: true,
        select: function (event, ui) {
            treeService.activateNode(ui.item.value);

            $searchInput.autocomplete('destroy');
            $dialog.dialog('close');
        },
        focus: function (event, ui) {
            event.preventDefault();
        },
        close: function (event, ui) {
            if (event.keyCode === 27) { // escape closes dialog
                $searchInput.autocomplete('destroy');
                $dialog.dialog('close');
            }
            else {
                // keep autocomplete open
                // we're kind of abusing autocomplete to work in a way which it's not designed for
                $searchInput.autocomplete("search", "");
            }
        },
        create: () => $searchInput.autocomplete("search", ""),
        classes: {
            "ui-autocomplete": "recent-notes-autocomplete"
        }
    });
}

reload();

$(document).bind('keydown', 'ctrl+e', e => {
    showDialog();

    e.preventDefault();
});

$showDialogButton.click(showDialog);

export default {
    showDialog,
    addRecentNote,
    reload
};