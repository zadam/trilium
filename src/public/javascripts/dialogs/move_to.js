import noteAutocompleteService from "../services/note_autocomplete.js";
import utils from "../services/utils.js";
import toastService from "../services/toast.js";
import treeCache from "../services/tree_cache.js";
import treeChangesService from "../services/branches.js";
import appContext from "../services/app_context.js";

const $dialog = $("#move-to-dialog");
const $form = $("#move-to-form");
const $noteAutoComplete = $("#move-to-note-autocomplete");
const $noteList = $("#move-to-note-list");

let movedNodes;

export async function showDialog(nodes) {
    movedNodes = nodes;

    utils.openDialog($dialog);

    $noteAutoComplete.val('').trigger('focus');

    $noteList.empty();

    for (const node of movedNodes) {
        const note = await treeCache.getNote(node.data.noteId);

        $noteList.append($("<li>").text(note.title));
    }

    noteAutocompleteService.initNoteAutocomplete($noteAutoComplete);
    noteAutocompleteService.showRecentNotes($noteAutoComplete);
}

async function moveNotesTo(notePath) {
    // FIXME
    const targetNode = await appContext.getMainNoteTree().getNodeFromPath(notePath);

    await treeChangesService.moveToParentNote(movedNodes, targetNode);

    toastService.showMessage(`Selected notes have been moved into ${targetNode.title}`);
}

$form.on('submit', () => {
    const notePath = $noteAutoComplete.getSelectedPath();

    if (notePath) {
        $dialog.modal('hide');

        moveNotesTo(notePath);
    }
    else {
        console.error("No path to move to.");
    }

    return false;
});