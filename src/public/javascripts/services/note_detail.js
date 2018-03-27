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
import noteDetailCode from './note_detail_code.js';
import noteDetailText from './note_detail_text.js';
import noteDetailAttachment from './note_detail_attachment.js';

const $noteTitle = $("#note-title");

const $noteDetailComponents = $(".note-detail-component");
const $noteDetailSearch = $('#note-detail-search');
const $noteDetailRender = $('#note-detail-render');

const $protectButton = $("#protect-button");
const $unprotectButton = $("#unprotect-button");
const $noteDetailWrapper = $("#note-detail-wrapper");
const $noteIdDisplay = $("#note-id-display");
const $labelList = $("#label-list");
const $labelListInner = $("#label-list-inner");
const $searchString = $("#search-string");

let currentNote = null;

let noteChangeDisabled = false;

let isNoteChanged = false;

function getCurrentNote() {
    return currentNote;
}

function getCurrentNoteId() {
    return currentNote ? currentNote.noteId : null;
}

function getCurrentNoteType() {
    const currentNote = getCurrentNote();

    return currentNote ? currentNote.type : null;
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
        note.content = noteDetailText.getContent();
    }
    else if (note.type === 'code') {
        note.content = noteDetailCode.getContent();
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

async function showRenderNote() {
    $noteDetailRender.show();

    const bundle = await server.get('script/bundle/' + getCurrentNoteId());

    $noteDetailRender.html(bundle.html);

    await bundleService.executeBundle(bundle);
}

function showSearchNote() {
    $noteDetailSearch.show();

    try {
        const json = JSON.parse(currentNote.content);

        $searchString.val(json.searchString);
    }
    catch (e) {
        console.log(e);
        $searchString.val('');
    }

    $searchString.on('input', noteChanged);
}

async function handleProtectedSession() {
    await protectedSessionService.ensureProtectedSession(currentNote.isProtected, false);

    if (currentNote.isProtected) {
        protectedSessionHolder.touchProtectedSession();
    }

    // this might be important if we focused on protected note when not in protected note and we got a dialog
    // to login, but we chose instead to come to another node - at that point the dialog is still visible and this will close it.
    protectedSessionService.ensureDialogIsClosed();
}

async function loadNoteToEditor(noteId) {
    currentNote = await loadNote(noteId);

    if (isNewNoteCreated) {
        isNewNoteCreated = false;

        $noteTitle.focus().select();
    }

    $noteIdDisplay.html(noteId);

    await handleProtectedSession();

    $noteDetailWrapper.show();

    noteChangeDisabled = true;

    try {
        $noteTitle.val(currentNote.title);

        noteTypeService.setNoteType(currentNote.type);
        noteTypeService.setNoteMime(currentNote.mime);

        $noteDetailComponents.hide();

        if (currentNote.type === 'render') {
            await showRenderNote();
        }
        else if (currentNote.type === 'file') {
            await noteDetailAttachment.showFileNote();
        }
        else if (currentNote.type === 'text') {
            await noteDetailText.showTextNote();
        }
        else if (currentNote.type === 'code') {
            await noteDetailCode.showCodeNote();
        }
        else if (currentNote.type === 'search') {
            showSearchNote();
        }
    }
    finally {
        noteChangeDisabled = false;
    }

    setNoteBackgroundIfProtected(currentNote);
    treeService.setBranchBackgroundBasedOnProtectedStatus(noteId);

    // after loading new note make sure editor is scrolled to the top
    $noteDetailWrapper.scrollTop(0);

    await loadLabelList();
}

async function loadLabelList() {
    const noteId = getCurrentNoteId();

    const labels = await server.get('notes/' + noteId + '/labels');

    $labelListInner.html('');

    if (labels.length > 0) {
        for (const label of labels) {
            $labelListInner.append(utils.formatLabel(label) + " ");
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

function focus() {
    const note = getCurrentNote();

    if (note.type === 'text') {
        noteDetailText.focus();
    }
    else if (note.type === 'code') {
        noteDetailCode.focus();
    }
    else if (note.type === 'render' || note.type === 'file' || note.type === 'search') {
        // do nothing
    }
    else {
        infoService.throwError('Unrecognized type: ' + note.type);
    }
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

    noteDetailText.focus();
});

// this makes sure that when user e.g. reloads the page or navigates away from the page, the note's content is saved
// this sends the request asynchronously and doesn't wait for result
$(window).on('beforeunload', saveNoteIfChanged);

setInterval(saveNoteIfChanged, 5000);

export default {
    reload,
    switchToNote,
    updateNoteFromInputs,
    saveNoteToServer,
    setNoteBackgroundIfProtected,
    loadNote,
    getCurrentNote,
    getCurrentNoteType,
    getCurrentNoteId,
    newNoteCreated,
    focus,
    loadLabelList,
    saveNoteIfChanged,
    noteChanged
};