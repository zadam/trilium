import noteDetailService from '../services/note_detail.js';
import utils from '../services/utils.js';
import server from '../services/server.js';

const $dialog = $("#note-revisions-dialog");
const $list = $("#note-revision-list");
const $content = $("#note-revision-content");
const $title = $("#note-revision-title");

let revisionItems = [];
let note;

export async function showCurrentNoteRevisions() {
    await showNoteRevisionsDialog(noteDetailService.getActiveTabNoteId());
}

export async function showNoteRevisionsDialog(noteId, noteRevisionId) {
    utils.closeActiveDialog();

    glob.activeDialog = $dialog;

    $dialog.modal();

    $list.empty();
    $content.empty();

    note = noteDetailService.getActiveTabNote();
    revisionItems = await server.get(`notes/${noteId}/revisions`);

    for (const item of revisionItems) {
        $list.append($('<option>', {
            value: item.noteRevisionId,
            text: item.dateLastEdited
        }));
    }

    if (revisionItems.length > 0) {
        if (!noteRevisionId) {
            noteRevisionId = $list.find("option:first").val();
        }

        $list.val(noteRevisionId).trigger('change');
    }
    else {
        $title.text("No revisions for this note yet...");
    }
}

$list.on('change', async () => {
    const optVal = $list.find(":selected").val();

    const revisionItem = revisionItems.find(r => r.noteRevisionId === optVal);

    $title.html(revisionItem.title);

    const fullNoteRevision = await server.get(`notes/${revisionItem.noteId}/revisions/${revisionItem.noteRevisionId}`);

    if (note.type === 'text') {
        $content.html(fullNoteRevision.content);
    }
    else if (note.type === 'code') {
        $content.html($("<pre>").text(fullNoteRevision.content));
    }
    else {
        $content.text("Preview isn't available for this note type.");
    }
});