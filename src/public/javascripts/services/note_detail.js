import treeService from './tree.js';
import TabContext from './tab_context.js';
import server from './server.js';
import messagingService from "./messaging.js";
import infoService from "./info.js";
import treeCache from "./tree_cache.js";
import NoteFull from "../entities/note_full.js";
import bundleService from "./bundle.js";
import utils from "./utils.js";
import importDialog from "../dialogs/import.js";
import contextMenuService from "./context_menu.js";
import treeUtils from "./tree_utils.js";
import tabRow from "./tab_row.js";

const $tabContentsContainer = $("#note-tab-container");
const $savedIndicator = $(".saved-indicator");

let detailLoadedListeners = [];

async function reload() {
    // no saving here

    await loadNoteDetail(getActiveTabContext().notePath);
}

async function reloadTab(tabContext) {
    if (tabContext.note) {
        const note = await loadNote(tabContext.note.noteId);

        await loadNoteDetailToContext(tabContext, note, tabContext.notePath);
    }
}

async function reloadAllTabs() {
    for (const tabContext of tabContexts) {
        await reloadTab(tabContext);
    }
}

async function openInTab(notePath) {
    await loadNoteDetail(notePath, { newTab: true });
}

async function switchToNote(notePath) {
    await saveNotesIfChanged();

    await loadNoteDetail(notePath);

    openTabsChanged();
}

function onNoteChange(func) {
    return getActiveTabContext().getComponent().onNoteChange(func);
}

async function saveNotesIfChanged() {
    for (const ctx of tabContexts) {
        await ctx.saveNoteIfChanged();
    }

    // make sure indicator is visible in a case there was some race condition.
    $savedIndicator.fadeIn();
}

/** @type {TabContext[]} */
let tabContexts = [];

function getActiveEditor() {
    const activeTabContext = getActiveTabContext();

    if (activeTabContext && activeTabContext.note && activeTabContext.note.type === 'text') {
        return activeTabContext.getComponent().getEditor();
    }
    else {
        return null;
    }
}

async function activateOrOpenNote(noteId) {
    for (const tabContext of tabContexts) {
        if (tabContext.note && tabContext.note.noteId === noteId) {
            await tabContext.activate();
            return;
        }
    }

    // if no tab with this note has been found we'll create new tab

    await loadNoteDetail(noteId, {
        newTab: true,
        activate: true
    });
}

function getTabContexts() {
    return tabContexts;
}

/** @returns {TabContext} */
function getActiveTabContext() {
    const activeTabEl = tabRow.activeTabEl;

    if (!activeTabEl) {
        return null;
    }

    const tabId = activeTabEl.getAttribute('data-tab-id');

    return tabContexts.find(tc => tc.tabId === tabId);
}

/** @return {NoteFull} */
function getActiveNote() {
    const activeContext = getActiveTabContext();
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

async function switchToTab(tabId, notePath) {
    const tabContext = tabContexts.find(tc => tc.tabId === tabId);

    if (!tabContext) {
        await loadNoteDetail(notePath, {
            newTab: true,
            tabId: tabId,
            activate: true
        });
    } else {
        await tabContext.activate();

        if (notePath && tabContext.notePath !== notePath) {
            await treeService.activateNote(notePath);
        }
    }
}

async function showTab(tabId) {
    for (const ctx of tabContexts) {
        if (ctx.tabId === tabId) {
            ctx.show();
        }
        else {
            ctx.hide();
        }
    }

    const oldActiveNode = treeService.getActiveNode();

    if (oldActiveNode) {
        oldActiveNode.setActive(false);
    }

    treeService.clearSelectedNodes();

    const newActiveTabContext = getActiveTabContext();

    if (newActiveTabContext && newActiveTabContext.notePath) {
        const newActiveNode = await treeService.getNodeFromPath(newActiveTabContext.notePath);

        if (newActiveNode && newActiveNode.isVisible()) {
            newActiveNode.setActive(true, {noEvents: true});
        }
    }
}

async function renderComponent(ctx) {
    for (const componentType in ctx.components) {
        if (componentType !== ctx.note.type) {
            ctx.components[componentType].cleanup();
        }
    }

    ctx.$noteDetailComponents.hide();

    ctx.$noteTitle.show(); // this can be hidden by empty detail
    ctx.$noteTitle.removeAttr("readonly"); // this can be set by protected session service

    await ctx.getComponent().render();
}

/**
 * @param {TabContext} ctx
 * @param {NoteFull} note
 */
async function loadNoteDetailToContext(ctx, note, notePath) {
    ctx.setNote(note, notePath);

    openTabsChanged();

    if (utils.isDesktop()) {
        // needs to happen after loading the note itself because it references active noteId
        ctx.attributes.refreshAttributes();
    } else {
        // mobile usually doesn't need attributes so we just invalidate
        ctx.attributes.invalidateAttributes();
    }

    ctx.noteChangeDisabled = true;

    try {
        ctx.$noteTitle.val(ctx.note.title);

        if (utils.isDesktop()) {
            ctx.noteType.type(ctx.note.type);
            ctx.noteType.mime(ctx.note.mime);
        }

        await renderComponent(ctx);
    } finally {
        ctx.noteChangeDisabled = false;
    }

    treeService.setBranchBackgroundBasedOnProtectedStatus(note.noteId);

    // after loading new note make sure editor is scrolled to the top
    ctx.getComponent().scrollToTop();

    fireDetailLoaded();

    ctx.$scriptArea.empty();

    await bundleService.executeRelationBundles(ctx.note, 'runOnNoteView', ctx);

    if (utils.isDesktop()) {
        await ctx.attributes.showAttributes();

        await ctx.showChildrenOverview();
    }
}

async function loadNoteDetail(origNotePath, options = {}) {
    const newTab = !!options.newTab;
    const activate = !!options.activate;

    const notePath = await treeService.resolveNotePath(origNotePath);

    if (!notePath) {
        console.error(`Cannot resolve note path ${origNotePath}`);

        // fallback to display something
        if (tabContexts.length === 0) {
            await openEmptyTab();
        }

        return;
    }

    const noteId = treeUtils.getNoteIdFromNotePath(notePath);
    const loadedNote = await loadNote(noteId);
    let ctx;

    if (!getActiveTabContext() || newTab) {
        // if it's a new tab explicitly by user then it's in background
        ctx = new TabContext(tabRow, options.tabId);
        tabContexts.push(ctx);
    }
    else {
        ctx = getActiveTabContext();
    }

    // we will try to render the new note only if it's still the active one in the tree
    // this is useful when user quickly switches notes (by e.g. holding down arrow) so that we don't
    // try to render all those loaded notes one after each other. This only guarantees that correct note
    // will be displayed independent of timing
    const currentTreeNode = treeService.getActiveNode();
    if (!newTab && currentTreeNode && currentTreeNode.data.noteId !== loadedNote.noteId) {
        return;
    }

    await loadNoteDetailToContext(ctx, loadedNote, notePath);

    if (activate) {
        // will also trigger showTab via event
        await tabRow.activateTab(ctx.$tab[0]);
    }
}

async function loadNote(noteId) {
    const row = await server.get('notes/' + noteId);

    return new NoteFull(treeCache, row);
}

async function filterTabs(noteId) {
    for (const tc of tabContexts) {
        if (tc.notePath && !tc.notePath.split("/").includes(noteId)) {
            await tabRow.removeTab(tc.$tab[0]);
        }
    }

    if (tabContexts.length === 0) {
        await loadNoteDetail(noteId, {
            newTab: true,
            activate: true
        });
    }

    await saveOpenTabs();
}

async function noteDeleted(noteId) {
    for (const tc of tabContexts) {
        if (tc.notePath && tc.notePath.split("/").includes(noteId)) {
            await tabRow.removeTab(tc.$tab[0]);
        }
    }
}

async function refreshTabs(sourceTabId, noteId) {
    for (const tc of tabContexts) {
        if (tc.noteId === noteId && tc.tabId !== sourceTabId) {
            await reloadTab(tc);
        }
    }
}

function focusOnTitle() {
    getActiveTabContext().$noteTitle.focus();
}

function focusAndSelectTitle() {
    getActiveTabContext().$noteTitle.focus().select();
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
    const noteIdsToRefresh = new Set();

    syncData
        .filter(sync => sync.entityName === 'notes')
        .forEach(sync => noteIdsToRefresh.add(sync.entityId));

    syncData
        .filter(sync => sync.entityName === 'attributes')
        .forEach(sync => noteIdsToRefresh.add(sync.noteId));

    for (const noteId of noteIdsToRefresh) {
        refreshTabs(null, noteId);
    }
});

$tabContentsContainer.on("dragover", e => e.preventDefault());

$tabContentsContainer.on("dragleave", e => e.preventDefault());

$tabContentsContainer.on("drop", e => {
    const activeNote = getActiveNote();

    if (!activeNote) {
        return;
    }

    importDialog.uploadFiles(activeNote.noteId, e.originalEvent.dataTransfer.files, {
        safeImport: true,
        shrinkImages: true,
        textImportedAsText: true,
        codeImportedAsCode: true,
        explodeArchives: true
    });
});

async function openEmptyTab(render = true) {
    const ctx = new TabContext(tabRow);
    tabContexts.push(ctx);

    if (render) {
        await renderComponent(ctx);
    }

    await tabRow.activateTab(ctx.$tab[0]);
}

tabRow.addListener('newTab', openEmptyTab);

tabRow.addListener('activeTabChange', async ({ detail }) => {
    const tabId = detail.tabEl.getAttribute('data-tab-id');

    await showTab(tabId);

    console.log(`Activated tab ${tabId}`);
});

tabRow.addListener('tabRemove', async ({ detail }) => {
    const tabId = detail.tabEl.getAttribute('data-tab-id');

    const tabContextToDelete = tabContexts.find(nc => nc.tabId === tabId);

    if (tabContextToDelete) {
        // sometimes there are orphan autocompletes after closing the tab
        tabContextToDelete.closeAutocomplete();

        await tabContextToDelete.saveNoteIfChanged();
        tabContextToDelete.$tabContent.remove();
    }

    tabContexts = tabContexts.filter(nc => nc.tabId !== tabId);

    console.log(`Removed tab ${tabId}`);

    if (tabContexts.length === 0) {
        openEmptyTab();
    }
});

$(tabRow.el).on('contextmenu', '.note-tab', e => {
    const tab = $(e.target).closest(".note-tab");

    contextMenuService.initContextMenu(e, {
        getContextMenuItems: () => {
            return [
                {title: "Close all tabs", cmd: "removeAllTabs", uiIcon: "empty"},
                {title: "Close all tabs except for this", cmd: "removeAllTabsExceptForThis", uiIcon: "empty"}
            ];
        },
        selectContextMenuItem: (e, cmd) => {
            if (cmd === 'removeAllTabs') {
                tabRow.removeAllTabs();
            } else if (cmd === 'removeAllTabsExceptForThis') {
                tabRow.removeAllTabsExceptForThis(tab[0]);
            }
        }
    });
});

if (utils.isElectron()) {
    utils.bindShortcut('ctrl+t', () => {
        openEmptyTab();
    });

    utils.bindShortcut('ctrl+w', () => {
        if (tabRow.activeTabEl) {
            tabRow.removeTab(tabRow.activeTabEl);
        }
    });

    utils.bindShortcut('ctrl+tab', () => {
        const nextTab = tabRow.nextTabEl;

        if (nextTab) {
            tabRow.activateTab(nextTab);
        }
    });

    utils.bindShortcut('ctrl+shift+tab', () => {
        const prevTab = tabRow.previousTabEl;

        if (prevTab) {
            tabRow.activateTab(prevTab);
        }
    });
}

tabRow.addListener('activeTabChange', openTabsChanged);
tabRow.addListener('tabRemove', openTabsChanged);
tabRow.addListener('tabReorder', openTabsChanged);

let tabsChangedTaskId = null;

function clearOpenTabsTask() {
    if (tabsChangedTaskId) {
        clearTimeout(tabsChangedTaskId);
    }
}

function openTabsChanged() {
    // we don't want to send too many requests with tab changes so we always schedule task to do this in 3 seconds,
    // but if there's any change in between, we cancel the old one and schedule new one
    // so effectively we kind of wait until user stopped e.g. quickly switching tabs
    clearOpenTabsTask();

    tabsChangedTaskId = setTimeout(saveOpenTabs, 3000);
}

async function saveOpenTabs() {
    const activeTabEl = tabRow.activeTabEl;
    const openTabs = [];

    for (const tabEl of tabRow.tabEls) {
        const tabId = tabEl.getAttribute('data-tab-id');
        const tabContext = tabContexts.find(tc => tc.tabId === tabId);

        if (tabContext && tabContext.notePath) {
            openTabs.push({
                tabId: tabContext.tabId,
                notePath: tabContext.notePath,
                active: activeTabEl === tabEl
            });
        }
    }

    await server.put('options', {
        openTabs: JSON.stringify(openTabs)
    });
}

function noteChanged() {
    const activeTabContext = getActiveTabContext();

    if (activeTabContext) {
        activeTabContext.noteChanged();
    }
}

// this makes sure that when user e.g. reloads the page or navigates away from the page, the note's content is saved
// this sends the request asynchronously and doesn't wait for result
$(window).on('beforeunload', () => { saveNotesIfChanged(); }); // don't convert to short form, handler doesn't like returned promise

setInterval(saveNotesIfChanged, 3000);

export default {
    reload,
    reloadAllTabs,
    openInTab,
    switchToNote,
    loadNote,
    loadNoteDetail,
    getActiveNote,
    getActiveNoteType,
    getActiveNoteId,
    focusOnTitle,
    focusAndSelectTitle,
    saveNotesIfChanged,
    onNoteChange,
    addDetailLoadedListener,
    switchToTab,
    getTabContexts,
    getActiveTabContext,
    getActiveEditor,
    activateOrOpenNote,
    clearOpenTabsTask,
    filterTabs,
    openEmptyTab,
    noteDeleted,
    refreshTabs,
    noteChanged
};