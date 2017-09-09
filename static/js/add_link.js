$(document).bind('keydown', 'alt+l', function() {
    $("#noteAutocomplete").val('');
    $("#linkTitle").val('');

    const noteDetail = $('#noteDetail');
    noteDetail.summernote('editor.saveRange');

    $("#insertLinkDialog").dialog({
        modal: true,
        width: 500
    });

    function setDefaultLinkTitle(noteId) {
        const note = getNodeByKey(noteId);
        if (!note) {
            return;
        }

        let noteTitle = note.title;

        if (noteTitle.endsWith(" (clone)")) {
            noteTitle = noteTitle.substr(0, noteTitle.length - 8);
        }

        $("#linkTitle").val(noteTitle);
    }

    $("#noteAutocomplete").autocomplete({
        source: getAutocompleteItems(globalAllNoteIds),
        minLength: 0,
        change: function () {
            const val = $("#noteAutocomplete").val();
            const noteId = getNodeIdFromLabel(val);

            if (noteId) {
                setDefaultLinkTitle(noteId);
            }
        },
        // this is called when user goes through autocomplete list with keyboard
        // at this point the item isn't selected yet so we use supplied ui.item to see where the cursor is
        focus: function (event, ui) {
            const noteId = getNodeIdFromLabel(ui.item.value);

            setDefaultLinkTitle(noteId);
        }
    });
});

$("#insertLinkForm").submit(function() {
    let val = $("#noteAutocomplete").val();

    const noteId = getNodeIdFromLabel(val);

    if (noteId) {
        const linkTitle = $("#linkTitle").val();
        const noteDetail = $('#noteDetail');

        $("#insertLinkDialog").dialog("close");

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
$(document).on('click', 'div.popover-content a', function(e) {
    const targetUrl = $(e.target).attr("href");

    const noteIdMatch = /app#([A-Za-z0-9]{22})/.exec(targetUrl);

    if (noteIdMatch !== null) {
        const noteId = noteIdMatch[1];

        getNodeByKey(noteId).setActive();

        e.preventDefault();
    }
});

function getNodeIdFromLabel(label) {
    const noteIdMatch = / \(([A-Za-z0-9]{22})\)/.exec(label);

    if (noteIdMatch !== null) {
        return noteIdMatch[1];
    }

    return null;
}