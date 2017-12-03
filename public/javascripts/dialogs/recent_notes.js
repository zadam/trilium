"use strict";

const recentNotes = (function() {
    const dialogEl = $("#recent-notes-dialog");
    const selectBoxEl = $('#recent-notes-select-box');
    const jumpToButtonEl = $('#recentNotesJumpTo');
    const addLinkButtonEl = $('#recentNotesAddLink');
    const addCurrentAsChildEl = $("#recent-notes-add-current-as-child");
    const addRecentAsChildEl = $("#recent-notes-add-recent-as-child");
    const noteDetailEl = $('#note-detail');
    // list of recent note paths
    let list = [];

    async function reload() {
        const result = await server.get('recent-notes');

        list = result.map(r => r.note_path);
    }

    function addRecentNote(noteTreeId, notePath) {
        setTimeout(async () => {
            // we include the note into recent list only if the user stayed on the note at least 5 seconds
            if (notePath && notePath === noteTree.getCurrentNotePath()) {
                const result = await server.put('recent-notes/' + noteTreeId + '/' + encodeURIComponent(notePath));

                list = result.map(r => r.note_path);
            }
        }, 1500);
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
            const noteTitle = noteTree.getNotePathTitle(valueNotePath);

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

    function getSelectedNoteId() {
        const notePath = getSelectedNotePath();
        return treeUtils.getNoteIdFromNotePath(notePath);
    }

    function setActiveNoteBasedOnRecentNotes() {
        const notePath = getSelectedNotePath();

        noteTree.activateNode(notePath);

        dialogEl.dialog('close');
    }

    function addLinkBasedOnRecentNotes() {
        const notePath = getSelectedNotePath();
        const noteId = treeUtils.getNoteIdFromNotePath(notePath);

        const linkTitle = noteTree.getNoteTitle(noteId);

        dialogEl.dialog("close");

        noteDetailEl.summernote('editor.restoreRange');

        noteDetailEl.summernote('createLink', {
            text: linkTitle,
            url: 'app#' + notePath,
            isNewWindow: true
        });
    }

    async function addCurrentAsChild() {
        await treeChanges.cloneNoteTo(noteEditor.getCurrentNoteId(), getSelectedNoteId());

        dialogEl.dialog("close");
    }

    async function addRecentAsChild() {
        await treeChanges.cloneNoteTo(getSelectedNoteId(), noteEditor.getCurrentNoteId());

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

    reload();

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
        reload
    };
})();