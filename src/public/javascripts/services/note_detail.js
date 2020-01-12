import treeService from './tree.js';
import TabContext from './tab_context.js';
import server from './server.js';
import ws from "./ws.js";
import treeCache from "./tree_cache.js";
import NoteFull from "../entities/note_full.js";
import contextMenuService from "./context_menu.js";
import treeUtils from "./tree_utils.js";
import tabRow from "./tab_row.js";
import keyboardActionService from "./keyboard_actions.js";
import appContext from "./app_context.js";

const $tabContentsContainer = $("#note-tab-container");
const $savedIndicator = $(".saved-indicator");

let detailLoadedListeners = [];

async function reload() {
    // no saving here

    await loadNoteDetail(appContext.getActiveTabNotePath());
}

async function reloadNote(tabContext) {
    const note = await loadNote(tabContext.note.noteId);

    await loadNoteDetailToContext(tabContext, note, tabContext.notePath);
}

async function openInTab(notePath, activate) {
    await loadNoteDetail(notePath, { newTab: true, activate });
}

async function switchToNote(notePath) {
    await saveNotesIfChanged();

    await loadNoteDetail(notePath);

    openTabsChanged();
}

function onNoteChange(func) {
    return appContext.getActiveTabContext().getComponent().onNoteChange(func);
}

async function saveNotesIfChanged() {
    for (const ctx of appContext.getTabContexts()) {
        await ctx.saveNoteIfChanged();
    }

    // make sure indicator is visible in a case there was some race condition.
    $savedIndicator.fadeIn();
}

function getActiveEditor() {
    const activeTabContext = appContext.getActiveTabContext();

    if (activeTabContext && activeTabContext.note && activeTabContext.note.type === 'text') {
        return activeTabContext.getComponent().getEditor();
    }
    else {
        return null;
    }
}

async function activateOrOpenNote(noteId) {
    for (const tabContext of appContext.getTabContexts()) {
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

/**
 * @param {TabContext} ctx
 * @param {NoteFull} note
 * @param {string} notePath
 */
async function loadNoteDetailToContext(ctx, note, notePath) {
    await ctx.setNote(note, notePath);

    openTabsChanged();

    fireDetailLoaded();
}

async function loadNoteDetail(origNotePath, options = {}) {
    const newTab = !!options.newTab;
    const activate = !!options.activate;

    let notePath = await treeService.resolveNotePath(origNotePath);

    if (!notePath) {
        console.error(`Cannot resolve note path ${origNotePath}`);

        // fallback to display something
        notePath = 'root';
    }

    const noteId = treeUtils.getNoteIdFromNotePath(notePath);
    const loadedNote = await loadNote(noteId);
    const ctx = appContext.getTab(newTab, options.state);

    // we will try to render the new note only if it's still the active one in the tree
    // this is useful when user quickly switches notes (by e.g. holding down arrow) so that we don't
    // try to render all those loaded notes one after each other. This only guarantees that correct note
    // will be displayed independent of timing
    const currentTreeNode = appContext.getMainNoteTree().getActiveNode();
    if (!newTab && currentTreeNode && currentTreeNode.data.noteId !== loadedNote.noteId) {
        return;
    }
    
    const loadPromise = loadNoteDetailToContext(ctx, loadedNote, notePath).then(() => {
        if (activate) {
            // will also trigger showTab via event
            return tabRow.activateTab(ctx.$tab[0]);
        }
        else {
            return Promise.resolve();
        }
    });

    if (!options.async) {
        await loadPromise;
    }
}

async function loadNote(noteId) {
    const row = await server.get('notes/' + noteId);

    const noteShort = await treeCache.getNote(noteId);

    return new NoteFull(treeCache, row, noteShort);
}

async function filterTabs(noteId) {
    for (const tc of appContext.getTabContexts()) {
        if (tc.notePath && !tc.notePath.split("/").includes(noteId)) {
            await tabRow.removeTab(tc.$tab[0]);
        }
    }

    if (appContext.getTabContexts().length === 0) {
        await loadNoteDetail(noteId, {
            newTab: true,
            activate: true
        });
    }

    await saveOpenTabs();
}

async function noteDeleted(noteId) {
    for (const tc of appContext.getTabContexts()) {
        // not removing active even if it contains deleted note since that one will move to another note (handled by deletion logic)
        // and we would lose tab context state (e.g. sidebar visibility)
        if (!tc.isActive() && tc.notePath && tc.notePath.split("/").includes(noteId)) {
            await tabRow.removeTab(tc.$tab[0]);
        }
    }
}

function focusOnTitle() {
    appContext.getActiveTabContext().$noteTitle.trigger('focus');
}

function focusAndSelectTitle() {
    appContext.getActiveTabContext()
        .$noteTitle
            .trigger('focus')
            .trigger('select');
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
        if (noteId === appContext.getActiveTabNoteId()) {
            callback();
        }
    }

    // all the listeners are one time only
    detailLoadedListeners = [];
}

ws.subscribeToOutsideSyncMessages(syncData => {
    const noteIdsToRefresh = new Set();

    syncData
        .filter(sync => sync.entityName === 'notes')
        .forEach(sync => noteIdsToRefresh.add(sync.entityId));

    // we need to reload because of promoted attributes
    syncData
        .filter(sync => sync.entityName === 'attributes')
        .forEach(sync => noteIdsToRefresh.add(sync.noteId));

    for (const noteId of noteIdsToRefresh) {
        appContext.refreshTabs(null, noteId);
    }
});

ws.subscribeToAllSyncMessages(syncData => {
    for (const tc of appContext.getTabContexts()) {
        tc.eventReceived('syncData', syncData);
    }
});

$tabContentsContainer.on("dragover", e => e.preventDefault());

$tabContentsContainer.on("dragleave", e => e.preventDefault());

$tabContentsContainer.on("drop", async e => {
    const activeNote = appContext.getActiveTabNote();

    if (!activeNote) {
        return;
    }

    const files = [...e.originalEvent.dataTransfer.files]; // chrome has issue that dataTransfer.files empties after async operation

    const importService = await import("./import.js");

    importService.uploadFiles(activeNote.noteId, files, {
        safeImport: true,
        shrinkImages: true,
        textImportedAsText: true,
        codeImportedAsCode: true,
        explodeArchives: true
    });
});

$(tabRow.el).on('contextmenu', '.note-tab', e => {
    e.preventDefault();

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

keyboardActionService.setGlobalActionHandler('OpenNewTab', () => {
    openEmptyTab();
});

keyboardActionService.setGlobalActionHandler('CloseActiveTab', () => {
    if (tabRow.activeTabEl) {
        tabRow.removeTab(tabRow.activeTabEl);
    }
});

keyboardActionService.setGlobalActionHandler('ActivateNextTab', () => {
    const nextTab = tabRow.nextTabEl;

    if (nextTab) {
        tabRow.activateTab(nextTab);
    }
});

keyboardActionService.setGlobalActionHandler('ActivatePreviousTab', () => {
    const prevTab = tabRow.previousTabEl;

    if (prevTab) {
        tabRow.activateTab(prevTab);
    }
});

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
    // we don't want to send too many requests with tab changes so we always schedule task to do this in 1 seconds,
    // but if there's any change in between, we cancel the old one and schedule new one
    // so effectively we kind of wait until user stopped e.g. quickly switching tabs
    clearOpenTabsTask();

    tabsChangedTaskId = setTimeout(saveOpenTabs, 1000);
}

async function saveOpenTabs() {
    const openTabs = [];

    for (const tabEl of tabRow.tabEls) {
        const tabId = tabEl.getAttribute('data-tab-id');
        const tabContext = appContext.getTabContexts().find(tc => tc.tabId === tabId);

        if (tabContext) {
            const tabState = tabContext.getTabState();

            if (tabState) {
                openTabs.push(tabState);
            }
        }
    }

    await server.put('options', {
        openTabs: JSON.stringify(openTabs)
    });
}

function noteChanged() {
    const activeTabContext = appContext.getActiveTabContext();

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
    openInTab,
    switchToNote,
    loadNote,
    loadNoteDetail,
    focusOnTitle,
    focusAndSelectTitle,
    saveNotesIfChanged,
    onNoteChange,
    addDetailLoadedListener,
    getActiveEditor,
    activateOrOpenNote,
    clearOpenTabsTask,
    filterTabs,
    noteDeleted,
    noteChanged,
    openTabsChanged,
    reloadNote
};