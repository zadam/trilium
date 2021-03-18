import server from "../services/server.js";
import treeCache from "../services/tree_cache.js";
import linkService from "../services/link.js";
import utils from "../services/utils.js";

const $dialog = $("#delete-notes-dialog");
const $okButton = $("#delete-notes-dialog-ok-button");
const $cancelButton = $("#delete-notes-dialog-cancel-button");
const $deleteNotesList = $("#delete-notes-list");
const $brokenRelationsList = $("#broken-relations-list");
const $deletedNotesCount = $("#deleted-notes-count");
const $noNoteToDeleteWrapper = $("#no-note-to-delete-wrapper");
const $deleteNotesListWrapper = $("#delete-notes-list-wrapper");
const $brokenRelationsListWrapper = $("#broken-relations-wrapper");
const $brokenRelationsCount = $("#broke-relations-count");

const DELETE_NOTE_BUTTON_ID = "delete-notes-dialog-delete-note";

let $originallyFocused; // element focused before the dialog was opened so we can return to it afterwards

let branchIds = null;
let resolve = null;

export async function showDialog(branchIdsToDelete) {
    branchIds = branchIdsToDelete;

    $originallyFocused = $(':focus');

    const response = await server.post('delete-notes-preview', {branchIdsToDelete});

    $deleteNotesList.empty();
    $brokenRelationsList.empty();

    $deleteNotesListWrapper.toggle(response.noteIdsToBeDeleted.length > 0);
    $noNoteToDeleteWrapper.toggle(response.noteIdsToBeDeleted.length === 0);

    for (const note of await treeCache.getNotes(response.noteIdsToBeDeleted)) {
        $deleteNotesList.append(
            $("<li>").append(
                await linkService.createNoteLink(note.noteId, {showNotePath: true})
            )
        );
    }

    $deletedNotesCount.text(response.noteIdsToBeDeleted.length);

    $brokenRelationsListWrapper.toggle(response.brokenRelations.length > 0);
    $brokenRelationsCount.text(response.brokenRelations.length);

    await treeCache.getNotes(response.brokenRelations.map(br => br.noteId));

    for (const attr of response.brokenRelations) {
        $brokenRelationsList.append(
            $("<li>")
                .append(`Note `)
                .append(await linkService.createNoteLink(attr.value))
                .append(` (to be deleted) is referenced by relation <code>${attr.name}</code> originating from `)
                .append(await linkService.createNoteLink(attr.noteId))
        );
    }

    utils.openDialog($dialog);

    return new Promise((res, rej) => resolve = res);
}

export function isDeleteNoteChecked() {
    return $("#" + DELETE_NOTE_BUTTON_ID + ":checked").length > 0;
}

$dialog.on('shown.bs.modal', () => $okButton.trigger("focus"));

$cancelButton.on('click', () => {
    utils.closeActiveDialog();

    resolve({proceed: false});
});

$okButton.on('click', () => {
    utils.closeActiveDialog();

    resolve({
        proceed: true,
        deleteClones: false
    });
});
