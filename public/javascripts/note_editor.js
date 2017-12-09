"use strict";

const noteEditor = (function() {
    const noteTitleEl = $("#note-title");
    const noteDetailEl = $('#note-detail');
    const protectButton = $("#protect-button");
    const unprotectButton = $("#unprotect-button");
    const noteDetailWrapperEl = $("#note-detail-wrapper");
    let editor = null;

    let currentNote = null;

    let noteChangeDisabled = false;

    let isNoteChanged = false;

    function getCurrentNote() {
        return currentNote;
    }

    function getCurrentNoteId() {
        return currentNote ? currentNote.detail.note_id : null;
    }

    function noteChanged() {
        if (noteChangeDisabled) {
            return;
        }

        isNoteChanged = true;
    }

    async function reload() {
        // no saving here

        await loadNoteToEditor(getCurrentNoteId());
    }

    async function switchToNote(noteId) {
        if (getCurrentNoteId() !== noteId) {
            await saveNoteIfChanged();

            await loadNoteToEditor(noteId);
        }
    }

    async function saveNoteIfChanged() {
        if (!isNoteChanged) {
            return;
        }

        const note = noteEditor.getCurrentNote();

        updateNoteFromInputs(note);

        await saveNoteToServer(note);

        if (note.detail.is_protected) {
            protected_session.touchProtectedSession();
        }
    }

    function updateNoteFromInputs(note) {
        note.detail.note_text = editor.getData();

        const title = noteTitleEl.val();

        note.detail.note_title = title;

        noteTree.setNoteTitle(note.detail.note_id, title);
    }

    async function saveNoteToServer(note) {
        await server.put('notes/' + note.detail.note_id, note);

        isNoteChanged = false;

        showMessage("Saved!");
    }

    function setNoteBackgroundIfProtected(note) {
        if (note.detail.is_protected) {
            $("#note-detail").addClass("protected");
            protectButton.hide();
            unprotectButton.show();
        }
        else {
            $("#note-detail").removeClass("protected");
            protectButton.show();
            unprotectButton.hide();
        }

        noteTree.setCurrentNoteTreeBasedOnProtectedStatus();
    }

    let isNewNoteCreated = false;

    function newNoteCreated() {
        isNewNoteCreated = true;
    }

    async function loadNoteToEditor(noteId) {
        currentNote = await server.get('notes/' + noteId);

        if (isNewNoteCreated) {
            isNewNoteCreated = false;

            noteTitleEl.focus().select();
        }

        await protected_session.ensureProtectedSession(currentNote.detail.is_protected, false);

        if (currentNote.detail.is_protected) {
            protected_session.touchProtectedSession();
        }

        // this might be important if we focused on protected note when not in protected note and we got a dialog
        // to login, but we chose instead to come to another node - at that point the dialog is still visible and this will close it.
        protected_session.ensureDialogIsClosed();

        noteDetailWrapperEl.show();

        noteChangeDisabled = true;

        noteTitleEl.val(currentNote.detail.note_title);

        editor.setData(currentNote.detail.note_text);

        noteChangeDisabled = false;

        setNoteBackgroundIfProtected(currentNote);

        showAppIfHidden();
    }

    async function loadNote(noteId) {
        return await server.get('notes/' + noteId);
    }

    function getEditor() {
        return editor;
    }

    $(document).ready(() => {
        noteTitleEl.on('input', () => {
            noteChanged();

            const title = noteTitleEl.val();

            noteTree.setNoteTitle(getCurrentNoteId(), title);
        });

        BalloonEditor
            .create(document.querySelector('#note-detail'), {
            })
            .then(edit => {
                editor = edit;

                editor.document.on('changesDone', noteChanged);
            })
            .catch(error => {
                console.error(error);
            });

        // so that tab jumps from note title (which has tabindex 1)
        noteDetailEl.attr("tabindex", 2);
    });

    setInterval(saveNoteIfChanged, 5000);

    return {
        reload,
        switchToNote,
        saveNoteIfChanged,
        updateNoteFromInputs,
        saveNoteToServer,
        setNoteBackgroundIfProtected,
        loadNote,
        getCurrentNote,
        getCurrentNoteId,
        newNoteCreated,
        getEditor
    };
})();