import treeService from './tree.js';
import treeUtils from './tree_utils.js';
import noteTypeService from './note_type.js';
import protectedSessionService from './protected_session.js';
import protectedSessionHolder from './protected_session_holder.js';
import server from './server.js';
import messagingService from "./messaging.js";
import infoService from "./info.js";
import treeCache from "./tree_cache.js";
import NoteFull from "../entities/note_full.js";
import noteDetailCode from './note_detail_code.js';
import noteDetailText from './note_detail_text.js';
import noteDetailFile from './note_detail_file.js';
import noteDetailImage from './note_detail_image.js';
import noteDetailSearch from './note_detail_search.js';
import noteDetailRender from './note_detail_render.js';
import noteDetailRelationMap from './note_detail_relation_map.js';
import bundleService from "./bundle.js";
import attributeService from "./attributes.js";
import utils from "./utils.js";

const $noteTitle = $("#note-title");

const $noteDetailComponents = $(".note-detail-component");

const $protectButton = $("#protect-button");
const $unprotectButton = $("#unprotect-button");
const $noteDetailWrapper = $("#note-detail-wrapper");
const $noteIdDisplay = $("#note-id-display");
const $childrenOverview = $("#children-overview");
const $scriptArea = $("#note-detail-script-area");
const $savedIndicator = $("#saved-indicator");

let currentNote = null;

let noteChangeDisabled = false;

let isNoteChanged = false;

let detailLoadedListeners = [];

const components = {
    'code': noteDetailCode,
    'text': noteDetailText,
    'file': noteDetailFile,
    'image': noteDetailImage,
    'search': noteDetailSearch,
    'render': noteDetailRender,
    'relation-map': noteDetailRelationMap
};

function getComponent(type) {
    if (!type) {
        type = getCurrentNote().type;
    }

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

    $savedIndicator.fadeOut();
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

function getCurrentNoteContent() {
    return getComponent().getContent();
}

function onNoteChange(func) {
    return getComponent().onNoteChange(func);
}

async function saveNote() {
    const note = getCurrentNote();

    if (note.isProtected && !protectedSessionHolder.isProtectedSessionAvailable()) {
        return;
    }

    note.title = $noteTitle.val();
    note.content = getCurrentNoteContent(note);

    // it's important to set the flag back to false immediatelly after retrieving title and content
    // otherwise we might overwrite another change (especially async code)
    isNoteChanged = false;

    treeService.setNoteTitle(note.noteId, note.title);

    await server.put('notes/' + note.noteId, note.dto);

    if (note.isProtected) {
        protectedSessionHolder.touchProtectedSession();
    }

    $savedIndicator.fadeIn();

    // run async
    bundleService.executeRelationBundles(getCurrentNote(), 'runOnNoteChange');
}

async function saveNoteIfChanged() {
    if (isNoteChanged) {
        await saveNote();
    }

    // make sure indicator is visible in a case there was some race condition.
    $savedIndicator.fadeIn();
}

function setNoteBackgroundIfProtected(note) {
    $noteDetailWrapper.toggleClass("protected", note.isProtected);
    $protectButton.toggleClass("active", note.isProtected);
    $protectButton.prop("disabled", note.isProtected);
    $unprotectButton.toggleClass("active", !note.isProtected);
    $unprotectButton.prop("disabled", !note.isProtected || !protectedSessionHolder.isProtectedSessionAvailable());
}

async function handleProtectedSession() {
    const newSessionCreated = await protectedSessionService.ensureProtectedSession(currentNote.isProtected, false);

    if (currentNote.isProtected) {
        protectedSessionHolder.touchProtectedSession();
    }

    // this might be important if we focused on protected note when not in protected note and we got a dialog
    // to login, but we chose instead to come to another node - at that point the dialog is still visible and this will close it.
    protectedSessionService.ensureDialogIsClosed();

    return newSessionCreated;
}

async function loadNoteDetail(noteId) {
    const loadedNote = await loadNote(noteId);

    // we will try to render the new note only if it's still the active one in the tree
    // this is useful when user quickly switches notes (by e.g. holding down arrow) so that we don't
    // try to render all those loaded notes one after each other. This only guarantees that correct note
    // will be displayed independent of timing
    const currentTreeNode = treeService.getCurrentNode();
    if (currentTreeNode && currentTreeNode.data.noteId !== loadedNote.noteId) {
        return;
    }

    // only now that we're in sync with tree active node we will switch currentNote
    currentNote = loadedNote;

    if (utils.isDesktop()) {
        // needs to happen after loading the note itself because it references current noteId
        attributeService.refreshAttributes();
    }
    else {
        // mobile usually doesn't need attributes so we just invalidate
        attributeService.invalidateAttributes();
    }

    $noteIdDisplay.html(noteId);

    setNoteBackgroundIfProtected(currentNote);

    $noteDetailWrapper.show();

    noteChangeDisabled = true;

    try {
        $noteTitle.val(currentNote.title);

        if (utils.isDesktop()) {
            noteTypeService.setNoteType(currentNote.type);
            noteTypeService.setNoteMime(currentNote.mime);
        }

        for (const componentType in components) {
            if (componentType !== currentNote.type) {
                components[componentType].cleanup();
            }
        }

        $noteDetailComponents.hide();

        const newSessionCreated = await handleProtectedSession();
        if (newSessionCreated) {
            // in such case we're reloading note anyway so no need to continue here.
            return;
        }

        $noteTitle.removeAttr("readonly"); // this can be set by protected session service

        await getComponent(currentNote.type).show();
    }
    finally {
        noteChangeDisabled = false;
    }

    treeService.setBranchBackgroundBasedOnProtectedStatus(noteId);

    // after loading new note make sure editor is scrolled to the top
    getComponent(currentNote.type).scrollToTop();

    fireDetailLoaded();

    $scriptArea.empty();

    await bundleService.executeRelationBundles(getCurrentNote(), 'runOnNoteView');

    if (utils.isDesktop()) {
        await attributeService.showAttributes();

        await showChildrenOverview();
    }
}

async function showChildrenOverview() {
    const note = getCurrentNote();
    const attributes = await attributeService.getAttributes();
    const hideChildrenOverview = attributes.some(attr => attr.type === 'label' && attr.name === 'hideChildrenOverview')
        || note.type === 'relation-map'
        || note.type === 'image'
        || note.type === 'file';

    if (hideChildrenOverview) {
        $childrenOverview.hide();
        return;
    }

    $childrenOverview.empty();

    const notePath = treeService.getCurrentNotePath();

    for (const childBranch of await note.getChildBranches()) {
        const link = $('<a>', {
            href: 'javascript:',
            text: await treeUtils.getNoteTitle(childBranch.noteId, childBranch.parentNoteId)
        }).attr('data-action', 'note').attr('data-note-path', notePath + '/' + childBranch.noteId);

        const childEl = $('<div class="child-overview">').html(link);
        $childrenOverview.append(childEl);
    }

    $childrenOverview.show();
}

async function loadNote(noteId) {
    const row = await server.get('notes/' + noteId);

    return new NoteFull(treeCache, row);
}

function focusOnTitle() {
    $noteTitle.focus();
}

function focusAndSelectTitle() {
    $noteTitle.focus().select();
}

/**
 * Since detail loading may take some time and user might just browse through the notes using UP-DOWN keys,
 * we intentionally decouple activation of the note in the tree and full load of the note so just avaiting on
 * fancytree's activate() won't wait for the full load.
 *
 * This causes an issue where in some cases you want to do some action after detail is loaded. For this reason
 * we provide the listeners here which will be triggered after the detail is loaded and if the loaded note
 * is the one registered in the listener.
 */
function addDetailLoadedListener(noteId, callback) {
    detailLoadedListeners.push({ noteId, callback });
}

function fireDetailLoaded() {
    for (const {noteId, callback} of detailLoadedListeners) {
        if (noteId === currentNote.noteId) {
            callback();
        }
    }

    // all the listeners are one time only
    detailLoadedListeners = [];
}

messagingService.subscribeToSyncMessages(syncData => {
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

setInterval(saveNoteIfChanged, 3000);

export default {
    reload,
    switchToNote,
    setNoteBackgroundIfProtected,
    loadNote,
    getCurrentNote,
    getCurrentNoteType,
    getCurrentNoteId,
    focusOnTitle,
    focusAndSelectTitle,
    saveNote,
    saveNoteIfChanged,
    noteChanged,
    getCurrentNoteContent,
    onNoteChange,
    addDetailLoadedListener
};