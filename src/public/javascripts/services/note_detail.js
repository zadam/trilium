import treeService from './tree.js';
import noteTypeService from './note_type.js';
import protectedSessionService from './protected_session.js';
import utils from './utils.js';
import server from './server.js';

const $noteTitle = $("#note-title");

const $noteDetail = $('#note-detail');
const $noteDetailCode = $('#note-detail-code');
const $noteDetailSearch = $('#note-detail-search');
const $noteDetailRender = $('#note-detail-render');
const $noteDetailAttachment = $('#note-detail-attachment');

const $protectButton = $("#protect-button");
const $unprotectButton = $("#unprotect-button");
const $noteDetailWrapper = $("#note-detail-wrapper");
const $noteIdDisplay = $("#note-id-display");
const $labelList = $("#label-list");
const $labelListInner = $("#label-list-inner");
const $attachmentFileName = $("#attachment-filename");
const $attachmentFileType = $("#attachment-filetype");
const $attachmentFileSize = $("#attachment-filesize");
const $attachmentDownload = $("#attachment-download");
const $attachmentOpen = $("#attachment-open");
const $searchString = $("#search-string");

const $executeScriptButton = $("#execute-script-button");

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

    const note = getCurrentNote();

    updateNoteFromInputs(note);

    await saveNoteToServer(note);

    if (note.detail.isProtected) {
        protectedSessionService.touchProtectedSession();
    }
}

function updateNoteFromInputs(note) {
    if (note.detail.type === 'text') {
        let content = editor.getData();

        // if content is only tags/whitespace (typically <p>&nbsp;</p>), then just make it empty
        // this is important when setting new note to code
        if (jQuery(content).text().trim() === '' && !content.includes("<img")) {
            content = '';
        }

        note.detail.content = content;
    }
    else if (note.detail.type === 'code') {
        note.detail.content = codeEditor.getValue();
    }
    else if (note.detail.type === 'search') {
        note.detail.content = JSON.stringify({
            searchString: $searchString.val()
        });
    }
    else if (note.detail.type === 'render' || note.detail.type === 'file') {
        // nothing
    }
    else {
        utils.throwError("Unrecognized type: " + note.detail.type);
    }

    const title = $noteTitle.val();

    note.detail.title = title;

    treeService.setNoteTitle(note.detail.noteId, title);
}

async function saveNoteToServer(note) {
    await server.put('notes/' + note.detail.noteId, note);

    isNoteChanged = false;

    utils.showMessage("Saved!");
}

function setNoteBackgroundIfProtected(note) {
    const isProtected = !!note.detail.isProtected;

    $noteDetailWrapper.toggleClass("protected", isProtected);
    $protectButton.toggle(!isProtected);
    $unprotectButton.toggle(isProtected);
}

let isNewNoteCreated = false;

function newNoteCreated() {
    isNewNoteCreated = true;
}

async function setContent(content) {
    if (currentNote.detail.type === 'text') {
        if (!editor) {
            await utils.requireLibrary(utils.CKEDITOR);

            editor = await BalloonEditor.create($noteDetail[0], {});

            editor.document.on('change', noteChanged);
        }

        // temporary workaround for https://github.com/ckeditor/ckeditor5-enter/issues/49
        editor.setData(content ? content : "<p></p>");

        $noteDetail.show();
    }
    else if (currentNote.detail.type === 'code') {
        if (!codeEditor) {
            await utils.requireLibrary(utils.CODE_MIRROR);

            CodeMirror.keyMap.default["Shift-Tab"] = "indentLess";
            CodeMirror.keyMap.default["Tab"] = "indentMore";

            CodeMirror.modeURL = 'libraries/codemirror/mode/%N/%N.js';

            codeEditor = CodeMirror($("#note-detail-code")[0], {
                value: "",
                viewportMargin: Infinity,
                indentUnit: 4,
                matchBrackets: true,
                matchTags: { bothTags: true },
                highlightSelectionMatches: { showToken: /\w/, annotateScrollbar: false },
                lint: true,
                gutters: ["CodeMirror-lint-markers"],
                lineNumbers: true
            });

            codeEditor.on('change', noteChanged);
        }

        $noteDetailCode.show();

        // this needs to happen after the element is shown, otherwise the editor won't be refresheds
        codeEditor.setValue(content);

        const info = CodeMirror.findModeByMIME(currentNote.detail.mime);

        if (info) {
            codeEditor.setOption("mode", info.mime);
            CodeMirror.autoLoadMode(codeEditor, info.mode);
        }

        codeEditor.refresh();
    }
    else if (currentNote.detail.type === 'search') {
        $noteDetailSearch.show();

        try {
            const json = JSON.parse(content);

            $searchString.val(json.searchString);
        }
        catch (e) {
            console.log(e);
            $searchString.val('');
        }

        $searchString.on('input', noteChanged);
    }
}

async function loadNoteToEditor(noteId) {
    currentNote = await loadNote(noteId);

    if (isNewNoteCreated) {
        isNewNoteCreated = false;

        $noteTitle.focus().select();
    }

    $noteIdDisplay.html(noteId);

    await protectedSessionService.ensureProtectedSession(currentNote.detail.isProtected, false);

    if (currentNote.detail.isProtected) {
        protectedSessionService.touchProtectedSession();
    }

    // this might be important if we focused on protected note when not in protected note and we got a dialog
    // to login, but we chose instead to come to another node - at that point the dialog is still visible and this will close it.
    protectedSessionService.ensureDialogIsClosed();

    $noteDetailWrapper.show();

    noteChangeDisabled = true;

    $noteTitle.val(currentNote.detail.title);

    noteTypeService.setNoteType(currentNote.detail.type);
    noteTypeService.setNoteMime(currentNote.detail.mime);

    $noteDetail.hide();
    $noteDetailSearch.hide();
    $noteDetailCode.hide();
    $noteDetailRender.html('').hide();
    $noteDetailAttachment.hide();

    if (currentNote.detail.type === 'render') {
        $noteDetailRender.show();

        const bundle = await server.get('script/bundle/' + getCurrentNoteId());

        $noteDetailRender.html(bundle.html);

        utils.executeBundle(bundle);
    }
    else if (currentNote.detail.type === 'file') {
        $noteDetailAttachment.show();

        $attachmentFileName.text(currentNote.labels.original_file_name);
        $attachmentFileSize.text(currentNote.labels.file_size + " bytes");
        $attachmentFileType.text(currentNote.detail.mime);
    }
    else {
        await setContent(currentNote.detail.content);
    }

    noteChangeDisabled = false;

    setNoteBackgroundIfProtected(currentNote);
    treeService.setBranchBackgroundBasedOnProtectedStatus(noteId);

    // after loading new note make sure editor is scrolled to the top
    $noteDetailWrapper.scrollTop(0);

    loadLabelList();
}

async function loadLabelList() {
    const noteId = getCurrentNoteId();

    const labels = await server.get('notes/' + noteId + '/labels');

    $labelListInner.html('');

    if (labels.length > 0) {
        for (const attr of labels) {
            $labelListInner.append(utils.formatLabel(attr) + " ");
        }

        $labelList.show();
    }
    else {
        $labelList.hide();
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
        $noteDetail.focus();
    }
    else if (note.detail.type === 'code') {
        codeEditor.focus();
    }
    else if (note.detail.type === 'render' || note.detail.type === 'file' || note.detail.type === 'search') {
        // do nothing
    }
    else {
        utils.throwError('Unrecognized type: ' + note.detail.type);
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

        if (currentNote.detail.mime.endsWith("env=frontend")) {
            const bundle = await server.get('script/bundle/' + getCurrentNoteId());

            utils.executeBundle(bundle);
        }

        if (currentNote.detail.mime.endsWith("env=backend")) {
            await server.post('script/run/' + getCurrentNoteId());
        }

        utils.showMessage("Note executed");
    }
}

$attachmentDownload.click(() => utils.download(getAttachmentUrl()));

$attachmentOpen.click(() => {
    if (utils.isElectron()) {
        const open = require("open");

        open(getAttachmentUrl());
    }
    else {
        window.location.href = getAttachmentUrl();
    }
});

function getAttachmentUrl() {
    // electron needs absolute URL so we extract current host, port, protocol
    return utils.getHost() + "/api/attachments/download/" + getCurrentNoteId()
        + "?protectedSessionId=" + encodeURIComponent(protectedSessionService.getProtectedSessionId());
}

$(document).ready(() => {
    $noteTitle.on('input', () => {
        noteChanged();

        const title = $noteTitle.val();

        treeService.setNoteTitle(getCurrentNoteId(), title);
    });

    // so that tab jumps from note title (which has tabindex 1)
    $noteDetail.attr("tabindex", 2);
});

$(document).bind('keydown', "ctrl+return", executeCurrentNote);

$executeScriptButton.click(executeCurrentNote());

setInterval(saveNoteIfChanged, 5000);

export default {
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
    loadLabelList,
    setContent
};