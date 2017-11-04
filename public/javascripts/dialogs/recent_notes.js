const recentNotes = (function() {
    const dialogEl = $("#recent-notes-dialog");
    const selectBoxEl = $('#recent-notes-select-box');
    const jumpToButtonEl = $('#recentNotesJumpTo');
    const addLinkButtonEl = $('#recentNotesAddLink');
    const noteDetailEl = $('#note-detail');
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
        glob.activeDialog = dialogEl;

        noteDetailEl.summernote('editor.saveRange');

        dialogEl.dialog({
            modal: true,
            width: 800
        });

        selectBoxEl.find('option').remove();

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

            selectBoxEl.append(option);
        });
    }

    function getSelectedNoteIdFromRecentNotes() {
        return selectBoxEl.find("option:selected").val();
    }

    function setActiveNoteBasedOnRecentNotes() {
        const noteId = getSelectedNoteIdFromRecentNotes();

        getNodeByKey(noteId).setActive();

        dialogEl.dialog('close');
    }

    function addLinkBasedOnRecentNotes() {
        const noteId = getSelectedNoteIdFromRecentNotes();

        const linkTitle = getNoteTitle(noteId);

        dialogEl.dialog("close");

        noteDetailEl.summernote('editor.restoreRange');

        noteDetailEl.summernote('createLink', {
            text: linkTitle,
            url: 'app#' + noteId,
            isNewWindow: true
        });
    }

    selectBoxEl.keydown(e => {
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

    selectBoxEl.dblclick(e => {
        setActiveNoteBasedOnRecentNotes();
    });

    jumpToButtonEl.click(setActiveNoteBasedOnRecentNotes);
    addLinkButtonEl.click(addLinkBasedOnRecentNotes);

    return {
        showDialog,
        addRecentNote,
        removeRecentNote
    };
})();