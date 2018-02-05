"use strict";

const noteEditor = (function() {
    const noteTitleEl = $("#note-title");
    const noteDetailEl = $('#note-detail');
    const noteDetailCodeEl = $('#note-detail-code');
    const noteDetailRenderEl = $('#note-detail-render');
    const protectButton = $("#protect-button");
    const unprotectButton = $("#unprotect-button");
    const noteDetailWrapperEl = $("#note-detail-wrapper");
    const noteIdDisplayEl = $("#note-id-display");
    const attributeListEl = $("#attribute-list");
    const attributeListInnerEl = $("#attribute-list-inner");

    let editor = null;
    let codeEditor = null;

    let currentNote = null;

    let noteChangeDisabled = false;

    let isNoteChanged = false;

    function getCurrentNote() {
        return currentNote;
    }

    function getCurrentNoteId() {
        return currentNote ? currentNote.detail.noteId : null;
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

        if (note.detail.isProtected) {
            protected_session.touchProtectedSession();
        }
    }

    function updateNoteFromInputs(note) {
        if (note.detail.type === 'text') {
            note.detail.content = editor.getData();

            // if content is only tags/whitespace (typically <p>&nbsp;</p>), then just make it empty
            // this is important when setting new note to code
            if (jQuery(note.detail.content).text().trim() === '') {
                note.detail.content = ''
            }
        }
        else if (note.detail.type === 'code') {
            note.detail.content = codeEditor.getValue();
        }
        else if (note.detail.type === 'render') {
            // nothing
        }
        else {
            throwError("Unrecognized type: " + note.detail.type);
        }

        const title = noteTitleEl.val();

        note.detail.title = title;

        noteTree.setNoteTitle(note.detail.noteId, title);
    }

    async function saveNoteToServer(note) {
        await server.put('notes/' + note.detail.noteId, note);

        isNoteChanged = false;

        showMessage("Saved!");
    }

    function setNoteBackgroundIfProtected(note) {
        const isProtected = !!note.detail.isProtected;

        noteDetailWrapperEl.toggleClass("protected", isProtected);
        protectButton.toggle(!isProtected);
        unprotectButton.toggle(isProtected);
    }

    let isNewNoteCreated = false;

    function newNoteCreated() {
        isNewNoteCreated = true;
    }

    async function loadNoteToEditor(noteId) {
        currentNote = await loadNote(noteId);

        if (isNewNoteCreated) {
            isNewNoteCreated = false;

            noteTitleEl.focus().select();
        }

        noteIdDisplayEl.html(noteId);

        await protected_session.ensureProtectedSession(currentNote.detail.isProtected, false);

        if (currentNote.detail.isProtected) {
            protected_session.touchProtectedSession();
        }

        // this might be important if we focused on protected note when not in protected note and we got a dialog
        // to login, but we chose instead to come to another node - at that point the dialog is still visible and this will close it.
        protected_session.ensureDialogIsClosed();

        noteDetailWrapperEl.show();

        noteChangeDisabled = true;

        noteTitleEl.val(currentNote.detail.title);

        noteType.setNoteType(currentNote.detail.type);
        noteType.setNoteMime(currentNote.detail.mime);

        if (currentNote.detail.type === 'text') {
            // temporary workaround for https://github.com/ckeditor/ckeditor5-enter/issues/49
            editor.setData(currentNote.detail.content ? currentNote.detail.content : "<p></p>");

            noteDetailEl.show();
            noteDetailCodeEl.hide();
            noteDetailRenderEl.html('').hide();
        }
        else if (currentNote.detail.type === 'code') {
            noteDetailEl.hide();
            noteDetailCodeEl.show();
            noteDetailRenderEl.html('').hide();

            // this needs to happen after the element is shown, otherwise the editor won't be refresheds
            codeEditor.setValue(currentNote.detail.content);

            const info = CodeMirror.findModeByMIME(currentNote.detail.mime);

            if (info) {
                codeEditor.setOption("mode", info.mime);
                CodeMirror.autoLoadMode(codeEditor, info.mode);
            }
        }
        else if (currentNote.detail.type === 'render') {
            noteDetailEl.hide();
            noteDetailCodeEl.hide();
            noteDetailRenderEl.html('').show();

            const subTree = await server.get('script/subtree/' + getCurrentNoteId());

            noteDetailRenderEl.html(subTree);
        }
        else {
            throwError("Unrecognized type " + currentNote.detail.type);
        }

        noteChangeDisabled = false;

        setNoteBackgroundIfProtected(currentNote);
        noteTree.setNoteTreeBackgroundBasedOnProtectedStatus(noteId);

        // after loading new note make sure editor is scrolled to the top
        noteDetailWrapperEl.scrollTop(0);

        loadAttributeList();
    }

    async function loadAttributeList() {
        const noteId = getCurrentNoteId();

        const attributes = await server.get('notes/' + noteId + '/attributes');

        attributeListInnerEl.html('');

        if (attributes.length > 0) {
            for (const attr of attributes) {
                attributeListInnerEl.append(formatAttribute(attr) + " ");
            }

            attributeListEl.show();
        }
        else {
            attributeListEl.hide();
        }
    }

    async function loadNote(noteId) {
        return await server.get('notes/' + noteId);
    }

    function getEditor() {
        return editor;
    }

    function focus() {
        const note = getCurrentNote();

        if (note.detail.type === 'text') {
            noteDetailEl.focus();
        }
        else if (note.detail.type === 'code') {
            codeEditor.focus();
        }
        else if (note.detail.type === 'render') {
            // do nothing
        }
        else {
            throwError('Unrecognized type: ' + note.detail.type);
        }
    }

    function getCurrentNoteType() {
        const currentNote = getCurrentNote();

        return currentNote ? currentNote.detail.type : null;
    }

    async function executeCurrentNote() {
        if (getCurrentNoteType() === 'code') {
            // make sure note is saved so we load latest changes
            await saveNoteIfChanged();

            const script = await server.get('script/subtree/' + getCurrentNoteId());

            executeScript(script);
        }
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

                editor.document.on('change', noteChanged);
            })
            .catch(error => {
                console.error(error);
            });

        CodeMirror.keyMap.default["Shift-Tab"] = "indentLess";
        CodeMirror.keyMap.default["Tab"] = "indentMore";

        CodeMirror.modeURL = 'libraries/codemirror/mode/%N/%N.js';

        codeEditor = CodeMirror($("#note-detail-code")[0], {
            value: "",
            viewportMargin: Infinity,
            indentUnit: 4,
            matchBrackets: true,
            matchTags: { bothTags: true },
            highlightSelectionMatches: { showToken: /\w/, annotateScrollbar: false }
        });

        codeEditor.on('change', noteChanged);

        // so that tab jumps from note title (which has tabindex 1)
        noteDetailEl.attr("tabindex", 2);
    });

    $(document).bind('keydown', "ctrl+return", executeCurrentNote);

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
        getCurrentNoteType,
        getCurrentNoteId,
        newNoteCreated,
        getEditor,
        focus,
        executeCurrentNote,
        loadAttributeList
    };
})();