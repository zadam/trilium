"use strict";

const recentNotes = (function() {
    const dialogEl = $("#recent-notes-dialog");
    const selectBoxEl = $('#recent-notes-select-box');
    const jumpToButtonEl = $('#recentNotesJumpTo');
    const addLinkButtonEl = $('#recentNotesAddLink');
    const noteDetailEl = $('#note-detail');
    let list = [];

    $.ajax({
        url: baseApiUrl + 'recent-notes',
        type: 'GET',
        error: () => showError("Error getting recent notes.")
    }).then(result => {
        list = result.map(r => r.note_tree_id);
    });

    function addRecentNote(notePath) {
        setTimeout(() => {
            // we include the note into recent list only if the user stayed on the note at least 5 seconds
            if (notePath === noteTree.getCurrentNotePath()) {
                $.ajax({
                    url: baseApiUrl + 'recent-notes/' + encodeURIComponent(notePath),
                    type: 'PUT',
                    error: () => showError("Error setting recent notes.")
                }).then(result => {
                    list = result.map(r => r.note_path);
                });
            }
        }, 1500);
    }

    function removeRecentNote(notePathIdToRemove) {
        $.ajax({
            url: baseApiUrl + 'recent-notes/' + notePathIdToRemove,
            type: 'DELETE',
            error: () => showError("Error removing note from recent notes.")
        }).then(result => {
            list = result.map(r => r.note_path);
        });
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
        const recNotes = list.filter(note => note !== noteTree.getCurrentNotePath());

        $.each(recNotes, (key, valueNotePath) => {
            const noteTitle = treeUtils.getFullNameForPath(valueNotePath);

            const option = $("<option></option>")
                .attr("value", valueNotePath)
                .text(noteTitle);

            // select the first one (most recent one) by default
            if (key === 0) {
                option.attr("selected", "selected");
            }

            selectBoxEl.append(option);
        });
    }

    function getSelectedNotePathFromRecentNotes() {
        return selectBoxEl.find("option:selected").val();
    }

    function setActiveNoteBasedOnRecentNotes() {
        const notePath = getSelectedNotePathFromRecentNotes();

        noteTree.activateNode(notePath);

        dialogEl.dialog('close');
    }

    function addLinkBasedOnRecentNotes() {
        const notePath = getSelectedNotePathFromRecentNotes();

        const linkTitle = treeUtils.getNoteTitle(notePath);

        dialogEl.dialog("close");

        noteDetailEl.summernote('editor.restoreRange');

        noteDetailEl.summernote('createLink', {
            text: linkTitle,
            url: 'app#' + notePath,
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