let globalRecentNotes = [];

function addRecentNote(noteTreeId, noteContentId) {
    const origDate = new Date();

    setTimeout(function() {
        // we include the note into recent list only if the user stayed on the note at least 5 seconds
        if (noteTreeId === globalCurrentNote.detail.note_id || noteContentId === globalCurrentNote.detail.note_id) {
            // if it's already there, remove the note
            globalRecentNotes = globalRecentNotes.filter(note => note !== noteTreeId);

            globalRecentNotes.unshift(noteTreeId);
        }
    }, 1500);
}

function showRecentNotes() {
    $('#noteDetail').summernote('editor.saveRange');

    $("#recentNotesDialog").dialog({
        modal: true,
        width: 500
    });

    let recentNotesSelectBox = $('#recentNotesSelectBox');

    recentNotesSelectBox.find('option').remove();

    // remove the current note
    let recNotes = globalRecentNotes.filter(note => note !== globalCurrentNote.detail.note_id);

    $.each(recNotes, function(key, valueNoteId) {
        let noteTitle = getFullName(valueNoteId);

        if (!noteTitle) {
            return;
        }

        let option = $("<option></option>")
                .attr("value", valueNoteId)
                .text(noteTitle);

        // select the first one (most recent one) by default
        if (key === 0) {
            option.attr("selected", "selected");
        }

        recentNotesSelectBox.append(option);
    });
}

$(document).bind('keydown', 'alt+q', showRecentNotes);

function getSelectedNoteIdFromRecentNotes() {
    return $("#recentNotesSelectBox option:selected").val();
}

function setActiveNoteBasedOnRecentNotes() {
    const noteId = getSelectedNoteIdFromRecentNotes();

    getNodeByKey(noteId).setActive();

    $("#recentNotesDialog").dialog('close');
}

function addLinkBasedOnRecentNotes() {
    const noteId = getSelectedNoteIdFromRecentNotes();

    const linkTitle = getNoteTitle(noteId);
    const noteDetail = $('#noteDetail');

    $("#recentNotesDialog").dialog("close");

    noteDetail.summernote('editor.restoreRange');

    noteDetail.summernote('createLink', {
        text: linkTitle,
        url: 'app#' + noteId,
        isNewWindow: true
    });
}

$('#recentNotesSelectBox').keydown(function(e) {
    const key = e.which;

    if (key === 13)// the enter key code
    {
        setActiveNoteBasedOnRecentNotes();
    }
    else if (key === 76 /* l */) {
        addLinkBasedOnRecentNotes();
    }

    e.preventDefault();
});

$('#recentNotesSelectBox').dblclick(function(e) {
    setActiveNoteBasedOnRecentNotes();
});

$('#recentNotesJumpTo').click(setActiveNoteBasedOnRecentNotes);
$('#recentNotesAddLink').click(addLinkBasedOnRecentNotes);