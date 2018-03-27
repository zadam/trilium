import treeService from './tree.js';
import noteTypeService from './note_type.js';
import protectedSessionService from './protected_session.js';
import protectedSessionHolder from './protected_session_holder.js';
import utils from './utils.js';
import server from './server.js';
import messagingService from "./messaging.js";
import bundleService from "./bundle.js";
import infoService from "./info.js";
import treeCache from "./tree_cache.js";
import NoteFull from "../entities/note_full.js";

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
    return currentNote ? currentNote.noteId : null;
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

    if (note.isProtected) {
        protectedSessionHolder.touchProtectedSession();
    }
}

function updateNoteFromInputs(note) {
    if (note.type === 'text') {
        let content = editor.getData();

        // if content is only tags/whitespace (typically <p>&nbsp;</p>), then just make it empty
        // this is important when setting new note to code
        if (jQuery(content).text().trim() === '' && !content.includes("<img")) {
            content = '';
        }

        note.content = content;
    }
    else if (note.type === 'code') {
        note.content = codeEditor.getValue();
    }
    else if (note.type === 'search') {
        note.content = JSON.stringify({
            searchString: $searchString.val()
        });
    }
    else if (note.type === 'render' || note.type === 'file') {
        // nothing
    }
    else {
        infoService.throwError("Unrecognized type: " + note.type);
    }

    const title = $noteTitle.val();

    note.title = title;

    treeService.setNoteTitle(note.noteId, title);
}

async function saveNoteToServer(note) {
    await server.put('notes/' + note.noteId, note);

    isNoteChanged = false;

    infoService.showMessage("Saved!");
}

function setNoteBackgroundIfProtected(note) {
    const isProtected = !!note.isProtected;

    $noteDetailWrapper.toggleClass("protected", isProtected);
    $protectButton.toggle(!isProtected);
    $unprotectButton.toggle(isProtected);
}

let isNewNoteCreated = false;

function newNoteCreated() {
    isNewNoteCreated = true;
}

async function setContent(content) {
    if (currentNote.type === 'text') {
        if (!editor) {
            await utils.requireLibrary(utils.CKEDITOR);

            editor = await BalloonEditor.create($noteDetail[0], {});

            editor.document.on('change', noteChanged);
        }

        // temporary workaround for https://github.com/ckeditor/ckeditor5-enter/issues/49
        editor.setData(content ? content : "<p></p>");

        $noteDetail.show();
    }
    else if (currentNote.type === 'code') {
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

        const info = CodeMirror.findModeByMIME(currentNote.mime);

        if (info) {
            codeEditor.setOption("mode", info.mime);
            CodeMirror.autoLoadMode(codeEditor, info.mode);
        }

        codeEditor.refresh();
    }
    else if (currentNote.type === 'search') {
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

    await protectedSessionService.ensureProtectedSession(currentNote.isProtected, false);

    if (currentNote.isProtected) {
        protectedSessionHolder.touchProtectedSession();
    }

    // this might be important if we focused on protected note when not in protected note and we got a dialog
    // to login, but we chose instead to come to another node - at that point the dialog is still visible and this will close it.
    protectedSessionService.ensureDialogIsClosed();

    $noteDetailWrapper.show();

    noteChangeDisabled = true;

    $noteTitle.val(currentNote.title);

    noteTypeService.setNoteType(currentNote.type);
    noteTypeService.setNoteMime(currentNote.mime);

    $noteDetail.hide();
    $noteDetailSearch.hide();
    $noteDetailCode.hide();
    $noteDetailRender.html('').hide();
    $noteDetailAttachment.hide();

    if (currentNote.type === 'render') {
        $noteDetailRender.show();

        const bundle = await server.get('script/bundle/' + getCurrentNoteId());

        $noteDetailRender.html(bundle.html);

        bundleService.executeBundle(bundle);
    }
    else if (currentNote.type === 'file') {
        const labels = await server.get('notes/' + currentNote.noteId + '/labels');
        const labelMap = utils.toObject(labels, l => [l.name, l.value]);

        $noteDetailAttachment.show();

        $attachmentFileName.text(labelMap.original_file_name);
        $attachmentFileSize.text(labelMap.file_size + " bytes");
        $attachmentFileType.text(currentNote.mime);
    }
    else {
        await setContent(currentNote.content);
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
    const row = await server.get('notes/' + noteId);

    return new NoteFull(treeCache, row);
}

function getEditor() {
    return editor;
}

function focus() {
    const note = getCurrentNote();

    if (note.type === 'text') {
        $noteDetail.focus();
    }
    else if (note.type === 'code') {
        codeEditor.focus();
    }
    else if (note.type === 'render' || note.type === 'file' || note.type === 'search') {
        // do nothing
    }
    else {
        infoService.throwError('Unrecognized type: ' + note.type);
    }
}

function getCurrentNoteType() {
    const currentNote = getCurrentNote();

    return currentNote ? currentNote.type : null;
}

async function executeCurrentNote() {
    if (getCurrentNoteType() === 'code') {
        // make sure note is saved so we load latest changes
        await saveNoteIfChanged();

        if (currentNote.mime.endsWith("env=frontend")) {
            const bundle = await server.get('script/bundle/' + getCurrentNoteId());

            bundleService.executeBundle(bundle);
        }

        if (currentNote.mime.endsWith("env=backend")) {
            await server.post('script/run/' + getCurrentNoteId());
        }

        infoService.showMessage("Note executed");
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
        + "?protectedSessionId=" + encodeURIComponent(protectedSessionHolder.getProtectedSessionId());
}

messagingService.subscribeToMessages(syncData => {
    if (syncData.some(sync => sync.entityName === 'notes' && sync.entityId === getCurrentNoteId())) {
        infoService.showMessage('Reloading note because of background changes');

        reload();
    }
});

$(document).ready(() => {
    $noteTitle.on('input', () => {
        noteChanged();

        const title = $noteTitle.val();

        treeService.setNoteTitle(getCurrentNoteId(), title);
    });

    // so that tab jumps from note title (which has tabindex 1)
    $noteDetail.attr("tabindex", 2);
});

// this makes sure that when user e.g. reloads the page or navigates away from the page, the note's content is saved
// this sends the request asynchronously and doesn't wait for result
$(window).on('beforeunload', saveNoteIfChanged);

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