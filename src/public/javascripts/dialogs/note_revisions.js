import noteDetailService from '../services/note_detail.js';
import utils from '../services/utils.js';
import server from '../services/server.js';

const $dialog = $("#note-revisions-dialog");
const $list = $("#note-revision-list");
const $content = $("#note-revision-content");
const $title = $("#note-revision-title");

let revisionItems = [];
let note;

async function showCurrentNoteRevisions() {
    await showNoteRevisionsDialog(noteDetailService.getCurrentNoteId());
}

async function showNoteRevisionsDialog(noteId, noteRevisionId) {
    glob.activeDialog = $dialog;

    $dialog.modal();

    $list.empty();
    $content.empty();

    note = noteDetailService.getCurrentNote();
    revisionItems = await server.get('notes/' + noteId + '/revisions');

    for (const item of revisionItems) {
        const dateModified = utils.parseDate(item.dateModifiedFrom);

        $list.append($('<option>', {
            value: item.noteRevisionId,
            text: utils.formatDateTime(dateModified)
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

$list.on('change', () => {
    const optVal = $list.find(":selected").val();

    const revisionItem = revisionItems.find(r => r.noteRevisionId === optVal);

    $title.html(revisionItem.title);

    if (note.type === 'text') {
        $content.html(revisionItem.content);
    }
    else if (note.type === 'code') {
        $content.html($("<pre>").text(revisionItem.content));
    }
    else {
        $content.text("Preview isn't available for this note type.");
    }
});

$(document).on('click', "a[data-action='note-revision']", event => {
    const linkEl = $(event.target);
    const noteId = linkEl.attr('data-note-path');
    const noteRevisionId = linkEl.attr('data-note-revision-id');

    showNoteRevisionsDialog(noteId, noteRevisionId);

    return false;
});

export default {
    showCurrentNoteRevisions
};