import treeService from '../services/tree.js';
import server from '../services/server.js';

const $dialog = $("#recent-notes-dialog");
const $searchInput = $('#recent-notes-search-input');

function addRecentNote(branchId, notePath) {
    setTimeout(async () => {
        // we include the note into recent list only if the user stayed on the note at least 5 seconds
        if (notePath && notePath === treeService.getCurrentNotePath()) {
            const result = await server.put('recent-notes/' + branchId + '/' + encodeURIComponent(notePath));
        }
    }, 1500);
}

async function showDialog() {
    glob.activeDialog = $dialog;

    $dialog.dialog({
        modal: true,
        width: 800,
        height: 100,
        position: { my: "center top+100", at: "top", of: window }
    });

    $searchInput.val('');

    const result = await server.get('recent-notes');

    // remove the current note
    const recNotes = result.filter(note => note.notePath !== treeService.getCurrentNotePath());

    const items = recNotes.map(rn => {
        return {
            label: rn.title,
            value: rn.notePath
        };
    });

    $searchInput.autocomplete({
        source: items,
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

export default {
    showDialog,
    addRecentNote
};