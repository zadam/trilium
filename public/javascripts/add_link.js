$(document).bind('keydown', 'alt+l', () => {
    $("#note-autocomplete").val('');
    $("#link-title").val('');

    const noteDetail = $('#note-detail');
    noteDetail.summernote('editor.saveRange');

    $("#insert-link-dialog").dialog({
        modal: true,
        width: 500
    });

    function setDefaultLinkTitle(noteId) {
        const noteTitle = getNoteTitle(noteId);

        $("#link-title").val(noteTitle);
    }

    $("#note-autocomplete").autocomplete({
        source: getAutocompleteItems(globalAllNoteIds),
        minLength: 0,
        change: () => {
            const val = $("#note-autocomplete").val();
            const noteId = getNodeIdFromLabel(val);

            if (noteId) {
                setDefaultLinkTitle(noteId);
            }
        },
        // this is called when user goes through autocomplete list with keyboard
        // at this point the item isn't selected yet so we use supplied ui.item to see where the cursor is
        focus: (event, ui) => {
            const noteId = getNodeIdFromLabel(ui.item.value);

            setDefaultLinkTitle(noteId);
        }
    });
});

$("#insert-link-form").submit(() => {
    let val = $("#note-autocomplete").val();

    const noteId = getNodeIdFromLabel(val);

    if (noteId) {
        const linkTitle = $("#link-title").val();
        const noteDetail = $('#note-detail');

        $("#insert-link-dialog").dialog("close");

        noteDetail.summernote('editor.restoreRange');

        noteDetail.summernote('createLink', {
            text: linkTitle,
            url: 'app#' + noteId,
            isNewWindow: true
        });
    }

    return false;
});

// when click on link popup, in case of internal link, just go the the referenced note instead of default behavior
// of opening the link in new window/tab
$(document).on('click', 'div.popover-content a, div.ui-tooltip-content', e => {
    goToInternalNote(e);
});

$(document).on('dblclick', '.note-editable a, div.ui-tooltip-content', e => {
    goToInternalNote(e);
});

function goToInternalNote(e, callback) {
    const targetUrl = $(e.target).attr("href");

    const noteId = getNoteIdFromLink(targetUrl);

    if (noteId !== null) {
        getNodeByKey(noteId).setActive();

        // this is quite ugly hack, but it seems like we can't close the tooltip otherwise
        $("[role='tooltip']").remove();

        e.preventDefault();

        if (callback) {
            callback();
        }
    }
}

function getNoteIdFromLink(url) {
    const noteIdMatch = /app#([A-Za-z0-9]{12})/.exec(url);

    if (noteIdMatch === null) {
        return null;
    }
    else {
        return noteIdMatch[1];
    }
}

function getNodeIdFromLabel(label) {
    const noteIdMatch = / \(([A-Za-z0-9]{12})\)/.exec(label);

    if (noteIdMatch !== null) {
        return noteIdMatch[1];
    }

    return null;
}