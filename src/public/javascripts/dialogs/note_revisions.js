import noteDetailService from '../services/note_detail.js';
import utils from '../services/utils.js';
import server from '../services/server.js';

const $dialog = $("#note-revisions-dialog");
const $list = $("#note-revision-list");
const $content = $("#note-revision-content");
const $title = $("#note-revision-title");

let revisionItems = [];

async function showCurrentNoteRevisions() {
    await showNoteRevisionsDialog(noteDetailService.getCurrentNoteId());
}

async function showNoteRevisionsDialog(noteId, noteRevisionId) {
    glob.activeDialog = $dialog;

    $dialog.dialog({
        modal: true,
        width: 800,
        height: 700
    });

    $list.empty();
    $content.empty();

    revisionItems = await server.get('notes-revisions/' + noteId);

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
    $content.html(revisionItem.content);
});

$(document).on('click', "a[action='note-revision']", event => {
    const linkEl = $(event.target);
    const noteId = linkEl.attr('note-path');
    const noteRevisionId = linkEl.attr('note-revision-id');

    showNoteRevisionsDialog(noteId, noteRevisionId);

    return false;
});

export default {
    showCurrentNoteRevisions
};