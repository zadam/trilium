"use strict";

const noteHistory = (function() {
    const $showDialogButton = $("#show-history-button");
    const $dialog = $("#note-history-dialog");
    const $list = $("#note-history-list");
    const $content = $("#note-history-content");
    const $title = $("#note-history-title");

    let historyItems = [];

    async function showCurrentNoteHistory() {
        await showNoteHistoryDialog(noteEditor.getCurrentNoteId());
    }

    async function showNoteHistoryDialog(noteId, noteRevisionId) {
        glob.activeDialog = $dialog;

        $dialog.dialog({
            modal: true,
            width: 800,
            height: 700
        });

        $list.empty();
        $content.empty();

        historyItems = await server.get('notes-history/' + noteId);

        for (const item of historyItems) {
            const dateModified = utils.parseDate(item.dateModifiedFrom);

            $list.append($('<option>', {
                value: item.noteRevisionId,
                text: utils.formatDateTime(dateModified)
            }));
        }

        if (historyItems.length > 0) {
            if (!noteRevisionId) {
                noteRevisionId = $list.find("option:first").val();
            }

            $list.val(noteRevisionId).trigger('change');
        }
        else {
            $title.text("No history for this note yet...");
        }
    }

    $(document).bind('keydown', 'alt+h', e => {
        showCurrentNoteHistory();

        e.preventDefault();
    });

    $list.on('change', () => {
        const optVal = $list.find(":selected").val();

        const historyItem = historyItems.find(r => r.noteRevisionId === optVal);

        $title.html(historyItem.title);
        $content.html(historyItem.content);
    });

    $(document).on('click', "a[action='note-history']", event => {
        const linkEl = $(event.target);
        const noteId = linkEl.attr('note-path');
        const noteRevisionId = linkEl.attr('note-history-id');

        showNoteHistoryDialog(noteId, noteRevisionId);

        return false;
    });

    $showDialogButton.click(showCurrentNoteHistory);

    return {
        showCurrentNoteHistory
    };
})();