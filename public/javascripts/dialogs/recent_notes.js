"use strict";

const recentNotes = (function() {
    const dialogEl = $("#recent-notes-dialog");
    const selectBoxEl = $('#recent-notes-select-box');
    const jumpToButtonEl = $('#recentNotesJumpTo');
    const addLinkButtonEl = $('#recentNotesAddLink');
    const addCurrentAsChildEl = $("#recent-notes-add-current-as-child");
    const addRecentAsChildEl = $("#recent-notes-add-recent-as-child");
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

    // FIXME: this should be probably just refresh upon deletion, not explicit delete
    function removeRecentNote(notePathIdToRemove) {
        $.ajax({
            url: baseApiUrl + 'recent-notes/' + encodeURIComponent(notePathIdToRemove),
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

    function getSelectedNotePath() {
        return selectBoxEl.find("option:selected").val();
    }

    function setActiveNoteBasedOnRecentNotes() {
        const notePath = getSelectedNotePath();

        noteTree.activateNode(notePath);

        dialogEl.dialog('close');
    }

    function addLinkBasedOnRecentNotes() {
        const notePath = getSelectedNotePath();

        const linkTitle = noteTree.getNoteTitle(notePath);

        dialogEl.dialog("close");

        noteDetailEl.summernote('editor.restoreRange');

        noteDetailEl.summernote('createLink', {
            text: linkTitle,
            url: 'app#' + notePath,
            isNewWindow: true
        });
    }

    async function addCurrentAsChild() {
        await treeUtils.addAsChild(getSelectedNotePath(), noteTree.getCurrentNotePath());

        dialogEl.dialog("close");
    }

    async function addRecentAsChild() {
        await treeUtils.addAsChild(noteTree.getCurrentNotePath(), getSelectedNotePath());

        dialogEl.dialog("close");
    }

    selectBoxEl.keydown(e => {
        const key = e.which;

        // to get keycodes use http://keycode.info/
        if (key === 13)// the enter key code
        {
            setActiveNoteBasedOnRecentNotes();
        }
        else if (key === 76 /* l */) {
            addLinkBasedOnRecentNotes();
        }
        else if (key === 67 /* c */) {
            addCurrentAsChild();
        }
        else if (key === 82 /* r */) {
            addRecentAsChild()
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
    addCurrentAsChildEl.click(addCurrentAsChild);
    addRecentAsChildEl.click(addRecentAsChild);

    return {
        showDialog,
        addRecentNote,
        removeRecentNote
    };
})();