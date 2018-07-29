import treeService from './tree.js';
import treeUtils from './tree_utils.js';
import noteTypeService from './note_type.js';
import protectedSessionService from './protected_session.js';
import protectedSessionHolder from './protected_session_holder.js';
import utils from './utils.js';
import server from './server.js';
import messagingService from "./messaging.js";
import infoService from "./info.js";
import linkService from "./link.js";
import treeCache from "./tree_cache.js";
import NoteFull from "../entities/note_full.js";
import noteDetailCode from './note_detail_code.js';
import noteDetailText from './note_detail_text.js';
import noteDetailFile from './note_detail_file.js';
import noteDetailSearch from './note_detail_search.js';
import noteDetailRender from './note_detail_render.js';
import bundleService from "./bundle.js";

const $noteTitle = $("#note-title");

const $noteDetailComponents = $(".note-detail-component");

const $protectButton = $("#protect-button");
const $unprotectButton = $("#unprotect-button");
const $noteDetailWrapper = $("#note-detail-wrapper");
const $noteDetailComponentWrapper = $("#note-detail-component-wrapper");
const $noteIdDisplay = $("#note-id-display");
const $labelList = $("#label-list");
const $labelListInner = $("#label-list-inner");
const $relationList = $("#relation-list");
const $relationListInner = $("#relation-list-inner");
const $childrenOverview = $("#children-overview");
const $scriptArea = $("#note-detail-script-area");

let currentNote = null;

let noteChangeDisabled = false;

let isNoteChanged = false;

const components = {
    'code': noteDetailCode,
    'text': noteDetailText,
    'file': noteDetailFile,
    'search': noteDetailSearch,
    'render': noteDetailRender
};

function getComponent(type) {
    if (components[type]) {
        return components[type];
    }
    else {
        infoService.throwError("Unrecognized type: " + type);
    }
}

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

    await loadNoteDetail(getCurrentNoteId());
}

async function switchToNote(noteId) {
    if (getCurrentNoteId() !== noteId) {
        await saveNoteIfChanged();

        await loadNoteDetail(noteId);
    }
}

async function saveNote() {
    const note = getCurrentNote();

    note.title = $noteTitle.val();
    note.content = getComponent(note.type).getContent();

    treeService.setNoteTitle(note.noteId, note.title);

    await server.put('notes/' + note.noteId, note.dto);

    isNoteChanged = false;

    if (note.isProtected) {
        protectedSessionHolder.touchProtectedSession();
    }

    infoService.showMessage("Saved!");
}

async function saveNoteIfChanged() {
    if (!isNoteChanged) {
        return;
    }

    await saveNote();
}

function setNoteBackgroundIfProtected(note) {
    const isProtected = !!note.isProtected;

    $noteDetailComponentWrapper.toggleClass("protected", isProtected);
    $protectButton.toggleClass("active", isProtected);
    $unprotectButton.toggleClass("active", !isProtected);
}

let isNewNoteCreated = false;

function newNoteCreated() {
    isNewNoteCreated = true;
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

async function loadNoteDetail(noteId) {
    $scriptArea.html('');

    currentNote = await loadNote(noteId);

    if (isNewNoteCreated) {
        isNewNoteCreated = false;

        $noteTitle.focus().select();
    }

    $noteIdDisplay.html(noteId);

    setNoteBackgroundIfProtected(currentNote);

    await handleProtectedSession();

    $noteDetailWrapper.show();

    noteChangeDisabled = true;

    try {
        $noteTitle.val(currentNote.title);

        noteTypeService.setNoteType(currentNote.type);
        noteTypeService.setNoteMime(currentNote.mime);

        $noteDetailComponents.hide();

        await getComponent(currentNote.type).show();
    }
    finally {
        noteChangeDisabled = false;
    }

    treeService.setBranchBackgroundBasedOnProtectedStatus(noteId);

    // after loading new note make sure editor is scrolled to the top
    $noteDetailWrapper.scrollTop(0);

    const labels = await loadLabelList();

    const hideChildrenOverview = labels.some(label => label.name === 'hideChildrenOverview');
    await showChildrenOverview(hideChildrenOverview);

    const relations = await loadRelationList();
    const relationsToRun = relations.filter(relation => relation.name === 'runOnNoteView');

    for (const relationToRun of relationsToRun) {
        await bundleService.getAndExecuteBundle(relationToRun.targetNoteId, getCurrentNote());
    }
}

async function showChildrenOverview(hideChildrenOverview) {
    if (hideChildrenOverview) {
        $childrenOverview.hide();
        return;
    }

    const note = getCurrentNote();

    $childrenOverview.empty();

    const notePath = treeService.getCurrentNotePath();

    for (const childBranch of await note.getChildBranches()) {
        const link = $('<a>', {
            href: 'javascript:',
            text: await treeUtils.getNoteTitle(childBranch.noteId, childBranch.parentNoteId)
        }).attr('action', 'note').attr('note-path', notePath + '/' + childBranch.noteId);

        const childEl = $('<div class="child-overview">').html(link);
        $childrenOverview.append(childEl);
    }

    $childrenOverview.show();
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

    return labels;
}

async function loadRelationList() {
    const noteId = getCurrentNoteId();

    const relations = await server.get('notes/' + noteId + '/relations');

    $relationListInner.html('');

    if (relations.length > 0) {
        for (const relation of relations) {
            $relationListInner.append(relation.name + " = ");
            $relationListInner.append(await linkService.createNoteLink(relation.targetNoteId));
            $relationListInner.append(" ");
        }

        $relationList.show();
    }
    else {
        $relationList.hide();
    }

    return relations;
}

async function loadNote(noteId) {
    const row = await server.get('notes/' + noteId);

    return new NoteFull(treeCache, row);
}

function focus() {
    const note = getCurrentNote();

    getComponent(note.type).focus();
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
$(window).on('beforeunload', () => { saveNoteIfChanged(); }); // don't convert to short form, handler doesn't like returned promise

setInterval(saveNoteIfChanged, 5000);

export default {
    reload,
    switchToNote,
    setNoteBackgroundIfProtected,
    loadNote,
    getCurrentNote,
    getCurrentNoteType,
    getCurrentNoteId,
    newNoteCreated,
    focus,
    loadLabelList,
    loadRelationList,
    saveNote,
    saveNoteIfChanged,
    noteChanged
};