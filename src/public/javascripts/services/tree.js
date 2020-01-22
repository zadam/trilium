import ws from './ws.js';
import noteDetailService from './note_detail.js';
import protectedSessionHolder from './protected_session_holder.js';
import treeUtils from './tree_utils.js';
import utils from './utils.js';
import server from './server.js';
import treeCache from './tree_cache.js';
import toastService from "./toast.js";
import treeBuilder from "./tree_builder.js";
import hoistedNoteService from '../services/hoisted_note.js';
import optionsService from "../services/options.js";
import bundle from "./bundle.js";
import keyboardActionService from "./keyboard_actions.js";
import appContext from "./app_context.js";

let setFrontendAsLoaded;
const frontendLoaded = new Promise(resolve => { setFrontendAsLoaded = resolve; });

async function setPrefix(branchId, prefix) {
    utils.assertArguments(branchId);

    const branch = treeCache.getBranch(branchId);

    branch.prefix = prefix;

    for (const node of await appContext.getMainNoteTree().getNodesByBranchId(branchId)) {
        await setNodeTitleWithPrefix(node);
    }
}

async function setNodeTitleWithPrefix(node) {
    const noteTitle = await treeUtils.getNoteTitle(node.data.noteId);
    const branch = treeCache.getBranch(node.data.branchId);

    const prefix = branch.prefix;

    const title = (prefix ? (prefix + " - ") : "") + noteTitle;

    node.setTitle(utils.escapeHtml(title));
}

/** @return {FancytreeNode} */
async function activateNote(notePath, noteLoadedListener) {
    utils.assertArguments(notePath);

    // notePath argument can contain only noteId which is not good when hoisted since
    // then we need to check the whole note path
    const runNotePath = await getRunPath(notePath);

    if (!runNotePath) {
        console.log("Cannot activate " + notePath);
        return;
    }

    const hoistedNoteId = await hoistedNoteService.getHoistedNoteId();

    if (hoistedNoteId !== 'root' && !runNotePath.includes(hoistedNoteId)) {
        const confirmDialog = await import('../dialogs/confirm.js');

        if (!await confirmDialog.confirm("Requested note is outside of hoisted note subtree. Do you want to unhoist?")) {
            return;
        }

        // unhoist so we can activate the note
        await hoistedNoteService.unhoist();
    }

    utils.closeActiveDialog();

    const node = await appContext.getMainNoteTree().expandToNote(notePath);

    if (noteLoadedListener) {
        noteDetailService.addDetailLoadedListener(node.data.noteId, noteLoadedListener);
    }

    await node.setActive(true);

    return node;
}

/**
 * Accepts notePath which might or might not be valid and returns an existing path as close to the original
 * notePath as possible.
 * @return {string|null}
 */
async function resolveNotePath(notePath) {
    const runPath = await getRunPath(notePath);

    return runPath ? runPath.join("/") : null;
}

/**
 * Accepts notePath and tries to resolve it. Part of the path might not be valid because of note moving (which causes
 * path change) or other corruption, in that case this will try to get some other valid path to the correct note.
 *
 * @return {string[]}
 */
async function getRunPath(notePath) {
    utils.assertArguments(notePath);

    notePath = notePath.split("-")[0].trim();

    if (notePath.length === 0) {
        return;
    }

    const path = notePath.split("/").reverse();

    if (!path.includes("root")) {
        path.push('root');
    }

    const hoistedNoteId = await hoistedNoteService.getHoistedNoteId();

    const effectivePath = [];
    let childNoteId = null;
    let i = 0;

    while (true) {
        if (i >= path.length) {
            break;
        }

        const parentNoteId = path[i++];

        if (childNoteId !== null) {
            const child = await treeCache.getNote(childNoteId);

            if (!child) {
                console.log("Can't find note " + childNoteId);
                return;
            }

            const parents = await child.getParentNotes();

            if (!parents) {
                ws.logError("No parents found for " + childNoteId);
                return;
            }

            if (!parents.some(p => p.noteId === parentNoteId)) {
                console.debug(utils.now(), "Did not find parent " + parentNoteId + " for child " + childNoteId);

                if (parents.length > 0) {
                    console.debug(utils.now(), "Available parents:", parents);

                    const someNotePath = await getSomeNotePath(parents[0]);

                    if (someNotePath) { // in case it's root the path may be empty
                        const pathToRoot = someNotePath.split("/").reverse();

                        for (const noteId of pathToRoot) {
                            effectivePath.push(noteId);
                        }

                        effectivePath.push('root');
                    }

                    break;
                }
                else {
                    ws.logError("No parents, can't activate node.");
                    return;
                }
            }
        }

        effectivePath.push(parentNoteId);
        childNoteId = parentNoteId;

        if (parentNoteId === hoistedNoteId) {
            break;
        }
    }

    return effectivePath.reverse();
}

async function getSomeNotePath(note) {
    utils.assertArguments(note);

    const path = [];

    let cur = note;

    while (cur.noteId !== 'root') {
        path.push(cur.noteId);

        const parents = await cur.getParentNotes();

        if (!parents.length) {
            console.error(`Can't find parents for note ${cur.noteId}`);
            return;
        }

        cur = parents[0];
    }

    path.push('root');

    return path.reverse().join('/');
}

async function setExpandedToServer(branchId, isExpanded) {
    utils.assertArguments(branchId);

    const expandedNum = isExpanded ? 1 : 0;

    await server.put('branches/' + branchId + '/expanded/' + expandedNum);
}

async function treeInitialized() {
    if (appContext.getTabContexts().length > 0) {
        // this is just tree reload - tabs are already in place
        return;
    }

    const options = await optionsService.waitForOptions();

    const openTabs = options.getJson('openTabs') || [];

    // if there's notePath in the URL, make sure it's open and active
    // (useful, among others, for opening clipped notes from clipper)
    if (location.hash) {
        const notePath = location.hash.substr(1);
        const noteId = treeUtils.getNoteIdFromNotePath(notePath);

        if (noteId && await treeCache.noteExists(noteId)) {
            for (const tab of openTabs) {
                tab.active = false;
            }

            const foundTab = openTabs.find(tab => noteId === treeUtils.getNoteIdFromNotePath(tab.notePath));

            if (foundTab) {
                foundTab.active = true;
            }
            else {
                openTabs.push({
                    notePath: notePath,
                    active: true
                });
            }
        }
    }

    let filteredTabs = [];

    for (const openTab of openTabs) {
        const noteId = treeUtils.getNoteIdFromNotePath(openTab.notePath);

        if (await treeCache.noteExists(noteId)) {
            // note doesn't exist so don't try to open tab for it
            filteredTabs.push(openTab);
        }
    }

    if (utils.isMobile()) {
        // mobile frontend doesn't have tabs so show only the active tab
        filteredTabs = filteredTabs.filter(tab => tab.active);
    }

    if (filteredTabs.length === 0) {
        filteredTabs.push({
            notePath: 'root',
            active: true
        });
    }

    if (!filteredTabs.find(tab => tab.active)) {
        filteredTabs[0].active = true;
    }

    for (const tab of filteredTabs) {
        await noteDetailService.loadNoteDetail(tab.notePath, {
            state: tab,
            newTab: true,
            activate: tab.active,
            async: true // faster initial load
        });
    }

    // previous opening triggered task to save tab changes but these are bogus changes (this is init)
    // so we'll cancel it
    appContext.clearOpenTabsTask();

    setFrontendAsLoaded();
}

async function reload() {
    const notes = await loadTreeData();

    const activeNode = appContext.getMainNoteTree().getActiveNode();

    const activeNotePath = activeNode !== null ? await treeUtils.getNotePath(activeNode) : null;

    await appContext.getMainNoteTree().reload(notes);

    // reactivate originally activated node, but don't trigger note loading
    if (activeNotePath) {
        const node = await appContext.getMainNoteTree().getNodeFromPath(activeNotePath, true);

        await node.setActive(true, {noEvents: true});
    }
}

function isNotePathInAddress() {
    const [notePath, tabId] = getHashValueFromAddress();

    return notePath.startsWith("root")
        // empty string is for empty/uninitialized tab
        || (notePath === '' && !!tabId);
}

function getHashValueFromAddress() {
    const str = document.location.hash ? document.location.hash.substr(1) : ""; // strip initial #

    return str.split("-");
}

async function loadTreeData() {
    const resp = await server.get('tree');

    treeCache.load(resp.notes, resp.branches);

    return await treeBuilder.prepareTree();
}

function setProtected(noteId, isProtected) {
    appContext.getMainNoteTree().getNodesByNoteId(noteId).map(node => {
        node.data.isProtected = isProtected;
        node.toggleClass("protected", isProtected);
    });
}

async function createNewTopLevelNote() {
    const hoistedNoteId = await hoistedNoteService.getHoistedNoteId();

    const rootNode = appContext.getMainNoteTree().getNodesByNoteId(hoistedNoteId)[0];

    await createNote(rootNode, hoistedNoteId, "into");
}

async function createNote(node, parentNoteId, target, extraOptions = {}) {
    utils.assertArguments(node, parentNoteId, target);

    extraOptions.activate = extraOptions.activate === undefined ? true : !!extraOptions.activate;

    // if isProtected isn't available (user didn't enter password yet), then note is created as unencrypted
    // but this is quite weird since user doesn't see WHERE the note is being created so it shouldn't occur often
    if (!extraOptions.isProtected || !protectedSessionHolder.isProtectedSessionAvailable()) {
        extraOptions.isProtected = false;
    }

    if (appContext.getActiveTabNoteType() !== 'text') {
        extraOptions.saveSelection = false;
    }

    if (extraOptions.saveSelection) {
        [extraOptions.title, extraOptions.content] = parseSelectedHtml(window.cutToNote.getSelectedHtml());
    }

    const newNoteName = extraOptions.title || "new note";

    const {note, branch} = await server.post(`notes/${parentNoteId}/children?target=${target}&targetBranchId=${node.data.branchId}`, {
        title: newNoteName,
        content: extraOptions.content || "",
        isProtected: extraOptions.isProtected,
        type: extraOptions.type
    });

    if (extraOptions.saveSelection) {
        // we remove the selection only after it was saved to server to make sure we don't lose anything
        window.cutToNote.removeSelection();
    }

    noteDetailService.addDetailLoadedListener(note.noteId, noteDetailService.focusAndSelectTitle);

    const noteEntity = await treeCache.getNote(note.noteId);
    const branchEntity = treeCache.getBranch(branch.branchId);

    let newNodeData = {
        title: newNoteName,
        noteId: branchEntity.noteId,
        parentNoteId: parentNoteId,
        refKey: branchEntity.noteId,
        branchId: branchEntity.branchId,
        isProtected: extraOptions.isProtected,
        type: noteEntity.type,
        extraClasses: await treeBuilder.getExtraClasses(noteEntity),
        icon: await treeBuilder.getIcon(noteEntity),
        folder: extraOptions.type === 'search',
        lazy: true,
        key: utils.randomString(12) // this should prevent some "duplicate key" errors
    };

    /** @var {FancytreeNode} */
    let newNode;

    if (target === 'after') {
        newNode = node.appendSibling(newNodeData);
    }
    else if (target === 'into') {
        if (!node.getChildren() && node.isFolder()) {
            // folder is not loaded - load will bring up the note since it was already put into cache
            await node.load(true);

            await node.setExpanded();
        }
        else {
            node.addChildren(newNodeData);
        }

        newNode = node.getLastChild();

        const parentNoteEntity = await treeCache.getNote(node.data.noteId);

        node.folder = true;
        node.icon = await treeBuilder.getIcon(parentNoteEntity); // icon might change into folder
        node.renderTitle();
    }
    else {
        toastService.throwError("Unrecognized target: " + target);
    }

    if (extraOptions.activate) {
        await newNode.setActive(true);
    }

    // need to refresh because original doesn't have methods like .getParent()
    newNodeData = appContext.getMainNoteTree().getNodesByNoteId(branchEntity.noteId)[0];

    // following for cycle will make sure that also clones of a parent are refreshed
    for (const newParentNode of appContext.getMainNoteTree().getNodesByNoteId(parentNoteId)) {
        if (newParentNode.key === newNodeData.getParent().key) {
            // we've added a note into this one so no need to refresh
            continue;
        }

        await newParentNode.load(true); // force reload to show up new note

        await appContext.getMainNoteTree().checkFolderStatus(newParentNode);
    }

    return {note, branch};
}

/* If first element is heading, parse it out and use it as a new heading. */
function parseSelectedHtml(selectedHtml) {
    const dom = $.parseHTML(selectedHtml);

    if (dom.length > 0 && dom[0].tagName && dom[0].tagName.match(/h[1-6]/i)) {
        const title = $(dom[0]).text();
        // remove the title from content (only first occurence)
        const content = selectedHtml.replace(dom[0].outerHTML, "");

        return [title, content];
    }
    else {
        return [null, selectedHtml];
    }
}

async function sortAlphabetically(noteId) {
    await server.put('notes/' + noteId + '/sort');

    await reload();
}

ws.subscribeToMessages(message => {
   if (message.type === 'refresh-tree') {
       reload();
   }
   else if (message.type === 'open-note') {
       noteDetailService.activateOrOpenNote(message.noteId);

       if (utils.isElectron()) {
           const currentWindow = require("electron").remote.getCurrentWindow();

           currentWindow.show();
       }
   }
});

// this is a synchronous handler - it returns only once the data has been updated
ws.subscribeToOutsideSyncMessages(async syncData => {
    const noteIdsToRefresh = new Set();

    // this has the problem that the former parentNoteId might not be invalidated
    // and the former location of the branch/note won't be removed.
    syncData.filter(sync => sync.entityName === 'branches').forEach(sync => noteIdsToRefresh.add(sync.parentNoteId));

    syncData.filter(sync => sync.entityName === 'notes').forEach(sync => noteIdsToRefresh.add(sync.entityId));

    syncData.filter(sync => sync.entityName === 'note_reordering').forEach(sync => noteIdsToRefresh.add(sync.entityId));

    syncData.filter(sync => sync.entityName === 'attributes').forEach(sync => {
        const note = treeCache.notes[sync.noteId];

        if (note && note.__attributeCache) {
            noteIdsToRefresh.add(sync.entityId);
        }
    });

    if (noteIdsToRefresh.size > 0) {
        await reloadNotes(Array.from(noteIdsToRefresh));
    }
});

async function reloadNotes(noteIds, activateNotePath = null) {
    if (noteIds.length === 0) {
        return;
    }

    await treeCache.reloadNotes(noteIds);

    if (!activateNotePath) {
        activateNotePath = appContext.getActiveTabNotePath();
    }

    appContext.trigger('notesReloaded', { noteIds, activateNotePath });
}

$(window).bind('hashchange', async function() {
    if (isNotePathInAddress()) {
        const [notePath, tabId] = getHashValueFromAddress();

        appContext.switchToTab(tabId, notePath);
    }
});

async function duplicateNote(noteId, parentNoteId) {
    const {note} = await server.post(`notes/${noteId}/duplicate/${parentNoteId}`);

    await reload();

    await activateNote(note.noteId);

    const origNote = await treeCache.getNote(noteId);
    toastService.showMessage(`Note "${origNote.title}" has been duplicated`);
}

frontendLoaded.then(bundle.executeStartupBundles);

export default {
    reload,
    setProtected,
    activateNote,
    setPrefix,
    createNote,
    sortAlphabetically,
    loadTreeData,
    treeInitialized,
    setExpandedToServer,
    reloadNotes,
    resolveNotePath,
    getSomeNotePath,
    createNewTopLevelNote,
    duplicateNote,
    getRunPath,
    setNodeTitleWithPrefix
};