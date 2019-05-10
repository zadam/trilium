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

const chromeTabsEl = document.querySelector('.chrome-tabs');
const chromeTabs = new ChromeTabs();
chromeTabs.init(chromeTabsEl);

const $tabContentsContainer = $("#note-tab-container");
const $savedIndicator = $(".saved-indicator");

let detailLoadedListeners = [];

/** @return {NoteFull} */
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

async function reloadAllTabs() {
    for (const tabContext of tabContexts) {
        const note = await loadNote(tabContext.note.noteId);

        await loadNoteDetailToContext(tabContext, note, tabContext.notePath);

    }
}

async function openInTab(noteId) {
    await loadNoteDetail(noteId, { newTab: true });
}

async function switchToNote(notePath) {
    await saveNotesIfChanged();

    await loadNoteDetail(notePath);
}

function getActiveNoteContent() {
    return getActiveContext().getComponent().getContent();
}

function onNoteChange(func) {
    return getActiveContext().getComponent().onNoteChange(func);
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

function getActiveComponent() {
    return getActiveContext().getComponent();
}

/** @returns {TabContext} */
function getActiveContext() {
    for (const ctx of tabContexts) {
        if (ctx.$tabContent.is(":visible")) {
            return ctx;
        }
    }
}

async function showTab(tabId) {
    tabId = parseInt(tabId);

    for (const ctx of tabContexts) {
        ctx.$tabContent.toggle(ctx.tabId === tabId);
    }

    const oldActiveNode = treeService.getActiveNode();

    if (oldActiveNode) {
        oldActiveNode.setActive(false);
    }

    treeService.clearSelectedNodes();

    const newActiveTabContext = getActiveContext();
    const newActiveNode = await treeService.getNodeFromPath(newActiveTabContext.notePath);

    if (newActiveNode && newActiveNode.isVisible()) {
        newActiveNode.setActive(true, { noEvents: true });
        newActiveNode.setSelected(true);
    }
}

/**
 * @param {TabContext} ctx
 * @param {NoteFull} note
 */
async function loadNoteDetailToContext(ctx, note, notePath) {
    ctx.setNote(note, notePath);

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

        for (const componentType in ctx.components) {
            if (componentType !== ctx.note.type) {
                ctx.components[componentType].cleanup();
            }
        }

        ctx.$noteDetailComponents.hide();

        ctx.$noteTitle.removeAttr("readonly"); // this can be set by protected session service

        await ctx.getComponent().show(ctx);
    } finally {
        ctx.noteChangeDisabled = false;
    }

    treeService.setBranchBackgroundBasedOnProtectedStatus(note.noteId);

    // after loading new note make sure editor is scrolled to the top
    ctx.getComponent().scrollToTop();

    fireDetailLoaded();

    ctx.$scriptArea.empty();

    await bundleService.executeRelationBundles(ctx.note, 'runOnNoteView');

    if (utils.isDesktop()) {
        await ctx.attributes.showAttributes();

        await ctx.showChildrenOverview();
    }
}

async function loadNoteDetail(notePath, options) {
    const newTab = !!options.newTab;
    const activate = !!options.activate;

    const noteId = treeUtils.getNoteIdFromNotePath(notePath);
    const loadedNote = await loadNote(noteId);
    let ctx;

    if (tabContexts.length === 0 || newTab) {
        // if it's a new tab explicitly by user then it's in background
        ctx = new TabContext(chromeTabs, newTab);
        tabContexts.push(ctx);
    }
    else {
        ctx = getActiveContext();
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
        chromeTabs.setCurrentTab(ctx.tab);
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

$tabContentsContainer.on("dragover", e => e.preventDefault());

$tabContentsContainer.on("dragleave", e => e.preventDefault());

$tabContentsContainer.on("drop", e => {
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

    tabContexts = tabContexts.filter(nc => nc.tabId !== tabId);

    console.log(`Removed tab ${tabId}`);
});

$(chromeTabsEl).on('contextmenu', '.chrome-tab', e => {
    const tab = $(e.target).closest(".chrome-tab");

    contextMenuService.initContextMenu(e, {
        getContextMenuItems: () => {
            return [
                {title: "Close all tabs except for this", cmd: "removeAllTabsExceptForThis", uiIcon: "empty"}
            ];
        },
        selectContextMenuItem: (e, cmd) => {
            if (cmd === 'removeAllTabsExceptForThis') {
                chromeTabs.removeAllTabsExceptForThis(tab[0]);
            }
        }
    });
});

if (utils.isElectron()) {
    utils.bindShortcut('ctrl+w', () => {
        if (tabContexts.length === 1) {
            // at least one tab must be present
            return;
        }

        chromeTabs.removeTab(chromeTabs.activeTabEl);
    });

    utils.bindShortcut('ctrl+tab', () => {
        const nextTab = chromeTabs.nextTabEl;

        if (nextTab) {
            chromeTabs.setCurrentTab(nextTab);
        }
    });

    utils.bindShortcut('ctrl+shift+tab', () => {
        const prevTab = chromeTabs.previousTabEl;

        if (prevTab) {
            chromeTabs.setCurrentTab(prevTab);
        }
    });
}

chromeTabsEl.addEventListener('activeTabChange', openTabsChanged);
chromeTabsEl.addEventListener('tabAdd', openTabsChanged);
chromeTabsEl.addEventListener('tabRemove', openTabsChanged);
chromeTabsEl.addEventListener('tabReorder', openTabsChanged);

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
    const activeTabEl = chromeTabs.activeTabEl;
    const openTabs = [];

    for (const tabEl of chromeTabs.tabEls) {
        const tabId = parseInt(tabEl.getAttribute('data-tab-id'));
        const tabContext = tabContexts.find(tc => tc.tabId === tabId);

        if (tabContext) {
            openTabs.push({
                notePath: tabContext.notePath,
                active: activeTabEl === tabEl
            });
        }
    }

    await server.put('options', {
        openTabs: JSON.stringify(openTabs)
    });
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
    getActiveNoteContent,
    getActiveNoteType,
    getActiveNoteId,
    focusOnTitle,
    focusAndSelectTitle,
    saveNotesIfChanged,
    onNoteChange,
    addDetailLoadedListener,
    getActiveContext,
    getActiveComponent,
    clearOpenTabsTask
};