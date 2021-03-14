import server from "../services/server.js";
import treeCache from "../services/tree_cache.js";
import linkService from "../services/link.js";

const $dialog = $("#delete-notes-dialog");
const $confirmContent = $("#delete-notes-dialog-content");
const $okButton = $("#delete-notes-dialog-ok-button");
const $cancelButton = $("#delete-notes-dialog-cancel-button");
const $custom = $("#delete-notes-dialog-custom");
const $deleteNotesList = $("#delete-notes-list");
const $brokenRelationsList = $("#broken-relations-list");
const $deletedNotesCount = $("#deleted-notes-count");
const $noNoteToDeleteWrapper = $("#no-note-to-delete-wrapper");
const $deleteNotesListWrapper = $("#delete-notes-list-wrapper");
const $brokenRelationsListWrapper = $("#broken-relations-wrapper");

const DELETE_NOTE_BUTTON_ID = "delete-notes-dialog-delete-note";

let $originallyFocused; // element focused before the dialog was opened so we can return to it afterwards

export async function showDialog(branchIdsToDelete) {
    $originallyFocused = $(':focus');

    $custom.hide();

    glob.activeDialog = $dialog;

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

    $dialog.modal();

    return new Promise((res, rej) => { resolve = res; });
}

export function isDeleteNoteChecked() {
    return $("#" + DELETE_NOTE_BUTTON_ID + ":checked").length > 0;
}

$dialog.on('shown.bs.modal', () => $okButton.trigger("focus"));

$dialog.on("hidden.bs.modal", () => {
    if (resolve) {
        resolve(false);
    }

    if ($originallyFocused) {
        $originallyFocused.trigger('focus');
        $originallyFocused = null;
    }
});

function doResolve(ret) {
    resolve(ret);
    resolve = null;

    $dialog.modal("hide");
}

$cancelButton.on('click', () => doResolve(false));
$okButton.on('click', () => doResolve(true));
