const recentNotes = (function() {
    const dialog = $("#recent-notes-dialog");
    const selectBox = $('#recent-notes-select-box');
    const jumpToButton = $('#recentNotesJumpTo');
    const addLinkButton = $('#recentNotesAddLink');
    const noteDetail = $('#note-detail');
    let list = [];

    function addRecentNote(noteTreeId, noteContentId) {
        setTimeout(() => {
            // we include the note into recent list only if the user stayed on the note at least 5 seconds
            if (noteTreeId === glob.currentNote.detail.note_id || noteContentId === glob.currentNote.detail.note_id) {
                // if it's already there, remove the note
                list = list.filter(note => note !== noteTreeId);

                list.unshift(noteTreeId);
            }
        }, 1500);
    }

    function removeRecentNote(noteIdToRemove) {
        list = list.filter(note => note !== noteIdToRemove);
    }

    function showDialog() {
        noteDetail.summernote('editor.saveRange');

        dialog.dialog({
            modal: true,
            width: 800
        });

        selectBox.find('option').remove();

        // remove the current note
        const recNotes = list.filter(note => note !== glob.currentNote.detail.note_id);

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

            selectBox.append(option);
        });
    }

    function getSelectedNoteIdFromRecentNotes() {
        return selectBox.find("option:selected").val();
    }

    function setActiveNoteBasedOnRecentNotes() {
        const noteId = getSelectedNoteIdFromRecentNotes();

        getNodeByKey(noteId).setActive();

        dialog.dialog('close');
    }

    function addLinkBasedOnRecentNotes() {
        const noteId = getSelectedNoteIdFromRecentNotes();

        const linkTitle = getNoteTitle(noteId);

        dialog.dialog("close");

        noteDetail.summernote('editor.restoreRange');

        noteDetail.summernote('createLink', {
            text: linkTitle,
            url: 'app#' + noteId,
            isNewWindow: true
        });
    }

    selectBox.keydown(e => {
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

    $(document).bind('keydown', 'alt+q', showDialog);

    selectBox.dblclick(e => {
        setActiveNoteBasedOnRecentNotes();
    });

    jumpToButton.click(setActiveNoteBasedOnRecentNotes);
    addLinkButton.click(addLinkBasedOnRecentNotes);

    return {
        showDialog,
        addRecentNote,
        removeRecentNote
    };
})();