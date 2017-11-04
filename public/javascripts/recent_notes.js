glob.recentNotes = [];

function addRecentNote(noteTreeId, noteContentId) {
    setTimeout(() => {
        // we include the note into recent list only if the user stayed on the note at least 5 seconds
        if (noteTreeId === glob.currentNote.detail.note_id || noteContentId === glob.currentNote.detail.note_id) {
            // if it's already there, remove the note
            glob.recentNotes = glob.recentNotes.filter(note => note !== noteTreeId);

            glob.recentNotes.unshift(noteTreeId);
        }
    }, 1500);
}

function showRecentNotes() {
    $('#note-detail').summernote('editor.saveRange');

    $("#recent-notes-dialog").dialog({
        modal: true,
        width: 800
    });

    const recentNotesSelectBox = $('#recent-notes-select-box');

    recentNotesSelectBox.find('option').remove();

    // remove the current note
    const recNotes = glob.recentNotes.filter(note => note !== glob.currentNote.detail.note_id);

    $.each(recNotes, (key, valueNoteId) => {
        const noteTitle = getFullName(valueNoteId);

        if (!noteTitle) {
            return;
        }

        const option = $("<option></option>")
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
    return $("#recent-notes-select-box option:selected").val();
}

function setActiveNoteBasedOnRecentNotes() {
    const noteId = getSelectedNoteIdFromRecentNotes();

    getNodeByKey(noteId).setActive();

    $("#recent-notes-dialog").dialog('close');
}

function addLinkBasedOnRecentNotes() {
    const noteId = getSelectedNoteIdFromRecentNotes();

    const linkTitle = getNoteTitle(noteId);
    const noteDetail = $('#note-detail');

    $("#recent-notes-dialog").dialog("close");

    noteDetail.summernote('editor.restoreRange');

    noteDetail.summernote('createLink', {
        text: linkTitle,
        url: 'app#' + noteId,
        isNewWindow: true
    });
}

$('#recent-notes-select-box').keydown(e => {
    const key = e.which;

    if (key === 13)// the enter key code
    {
        setActiveNoteBasedOnRecentNotes();
    }
    else if (key === 76 /* l */) {
        addLinkBasedOnRecentNotes();
    }
    else {
        return; // avoid prevent default
    }

    e.preventDefault();
});

$('#recent-notes-select-box').dblclick(e => {
    setActiveNoteBasedOnRecentNotes();
});

$('#recentNotesJumpTo').click(setActiveNoteBasedOnRecentNotes);
$('#recentNotesAddLink').click(addLinkBasedOnRecentNotes);