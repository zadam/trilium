import treeService from './tree.js';
import NoteContext from './note_context.js';
import noteTypeService from './note_type.js';
import protectedSessionService from './protected_session.js';
import protectedSessionHolder from './protected_session_holder.js';
import server from './server.js';
import messagingService from "./messaging.js";
import infoService from "./info.js";
import treeCache from "./tree_cache.js";
import NoteFull from "../entities/note_full.js";
import bundleService from "./bundle.js";
import utils from "./utils.js";
import importDialog from "../dialogs/import.js";

const chromeTabsEl = document.querySelector('.chrome-tabs');
const chromeTabs = new ChromeTabs();
chromeTabs.init(chromeTabsEl);

const $noteTabContentsContainer = $("#note-tab-container");
const $savedIndicator = $(".saved-indicator");

let detailLoadedListeners = [];

function getActiveNote() {
    const activeContext = getActiveContext();
    return activeContext ? activeContext.note : null;
}

function getActiveNoteId() {
    const activeNote = getActiveNote();

    return activeNote ? activeNote.noteId : null;
}

function getActiveNoteType() {
    const activeNote = getActiveNote();

    return activeNote ? activeNote.type : null;
}

async function reload() {
    // no saving here

    await loadNoteDetail(getActiveNoteId());
}

async function openInTab(noteId) {
    await loadNoteDetail(noteId, true);
}

async function switchToNote(noteId) {
    //if (getActiveNoteId() !== noteId) {
        await saveNotesIfChanged();

        await loadNoteDetail(noteId);
    //}
}

function getActiveNoteContent() {
    return getActiveContext().getComponent().getContent();
}

function onNoteChange(func) {
    return getActiveContext().getComponent().onNoteChange(func);
}

async function saveNotesIfChanged() {
    for (const ctx of noteContexts) {
        await ctx.saveNoteIfChanged();
    }

    // make sure indicator is visible in a case there was some race condition.
    $savedIndicator.fadeIn();
}

async function handleProtectedSession() {
    const newSessionCreated = await protectedSessionService.ensureProtectedSession(getActiveNote().isProtected, false);

    if (getActiveNote().isProtected) {
        protectedSessionHolder.touchProtectedSession();
    }

    // this might be important if we focused on protected note when not in protected note and we got a dialog
    // to login, but we chose instead to come to another node - at that point the dialog is still visible and this will close it.
    protectedSessionService.ensureDialogIsClosed();

    return newSessionCreated;
}

/** @type {NoteContext[]} */
let noteContexts = [];

/** @returns {NoteContext} */
function getContext(noteId) {
    const noteContext = noteContexts.find(nc => nc.noteId === noteId);

    if (noteContext) {
        return noteContext;
    }
    else {
        throw new Error(`Can't find note context for ${noteId}`);
    }
}

/** @returns {NoteContext} */
function getActiveContext() {
    for (const ctx of noteContexts) {
        if (ctx.$noteTabContent.is(":visible")) {
            return ctx;
        }
    }
}

function showTab(tabId) {
    tabId = parseInt(tabId);

    for (const ctx of noteContexts) {
        ctx.$noteTabContent.toggle(ctx.tabId === tabId);
    }
}

async function loadNoteDetail(noteId, newTab = false) {
    const loadedNote = await loadNote(noteId);
    let ctx;

    if (noteContexts.length === 0 || newTab) {
        // if it's a new tab explicitly by user then it's in background
        ctx = new NoteContext(chromeTabs, loadedNote, newTab);
        noteContexts.push(ctx);

        if (!newTab) {
            showTab(ctx.tabId);
        }
    }
    else {
        ctx = getActiveContext();
        ctx.setNote(loadedNote);
    }

    // we will try to render the new note only if it's still the active one in the tree
    // this is useful when user quickly switches notes (by e.g. holding down arrow) so that we don't
    // try to render all those loaded notes one after each other. This only guarantees that correct note
    // will be displayed independent of timing
    const currentTreeNode = treeService.getActiveNode();
    if (!newTab && currentTreeNode && currentTreeNode.data.noteId !== loadedNote.noteId) {
        return;
    }

    if (utils.isDesktop()) {
        // needs to happen after loading the note itself because it references active noteId
        // FIXME
        //attributeService.refreshAttributes();
    }
    else {
        // mobile usually doesn't need attributes so we just invalidate
        // FIXME
        //attributeService.invalidateAttributes();
    }

    ctx.updateNoteView();

    ctx.noteChangeDisabled = true;

    try {
        ctx.$noteTitle.val(ctx.note.title);

        if (utils.isDesktop()) {
            ctx.noteType.type(ctx.note.type);
            ctx.noteType.mime(ctx.note.mime);
        }

        for (const componentType in ctx.components) {
            if (componentType !== ctx.note.type) {
                ctx.components[componentType].cleanup();
            }
        }

        ctx.$noteDetailComponents.hide();

        const newSessionCreated = await handleProtectedSession();
        if (newSessionCreated) {
            // in such case we're reloading note anyway so no need to continue here.
            return;
        }

        ctx.$noteTitle.removeAttr("readonly"); // this can be set by protected session service

        await ctx.getComponent(ctx.note.type).show(ctx);
    }
    finally {
        ctx.noteChangeDisabled = false;
    }

    treeService.setBranchBackgroundBasedOnProtectedStatus(noteId);

    // after loading new note make sure editor is scrolled to the top
    ctx.getComponent(ctx.note.type).scrollToTop();

    fireDetailLoaded();

    ctx.$scriptArea.empty();

    await bundleService.executeRelationBundles(ctx.note, 'runOnNoteView');

    if (utils.isDesktop()) {
        await ctx.attributes.showAttributes();

        await ctx.showChildrenOverview();
    }
}

async function loadNote(noteId) {
    const row = await server.get('notes/' + noteId);

    return new NoteFull(treeCache, row);
}

function focusOnTitle() {
    getActiveContext().$noteTitle.focus();
}

function focusAndSelectTitle() {
    getActiveContext().$noteTitle.focus().select();
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
        if (noteId === getActiveNoteId()) {
            callback();
        }
    }

    // all the listeners are one time only
    detailLoadedListeners = [];
}

messagingService.subscribeToSyncMessages(syncData => {
    if (syncData.some(sync => sync.entityName === 'notes' && sync.entityId === getActiveNoteId())) {
        infoService.showMessage('Reloading note because of background changes');

        reload();
    }
});

$noteTabContentsContainer.on("dragover", e => e.preventDefault());

$noteTabContentsContainer.on("dragleave", e => e.preventDefault());

$noteTabContentsContainer.on("drop", e => {
    importDialog.uploadFiles(getActiveNoteId(), e.originalEvent.dataTransfer.files, {
        safeImport: true,
        shrinkImages: true,
        textImportedAsText: true,
        codeImportedAsCode: true,
        explodeArchives: true
    });
});

chromeTabsEl.addEventListener('activeTabChange', ({ detail }) => {
    const tabId = detail.tabEl.getAttribute('data-tab-id');

    showTab(tabId);

    console.log(`Activated tab ${tabId}`);
});

chromeTabsEl.addEventListener('tabRemove', ({ detail }) => {
    const tabId = parseInt(detail.tabEl.getAttribute('data-tab-id'));

    noteContexts = noteContexts.filter(nc => nc.tabId !== tabId);

    console.log(`Removed tab ${tabId}`);
});

if (utils.isElectron()) {
    utils.bindShortcut('ctrl+w', () => {
        if (noteContexts.length === 1) {
            // at least one tab must be present
            return;
        }

        chromeTabs.removeTab(chromeTabs.activeTabEl);
    });
}

// this makes sure that when user e.g. reloads the page or navigates away from the page, the note's content is saved
// this sends the request asynchronously and doesn't wait for result
$(window).on('beforeunload', () => { saveNotesIfChanged(); }); // don't convert to short form, handler doesn't like returned promise

setInterval(saveNotesIfChanged, 3000);

export default {
    reload,
    openInTab,
    switchToNote,
    loadNote,
    getActiveNote,
    getActiveNoteContent,
    getActiveNoteType,
    getActiveNoteId,
    focusOnTitle,
    focusAndSelectTitle,
    saveNotesIfChanged,
    onNoteChange,
    addDetailLoadedListener,
    getActiveContext
};