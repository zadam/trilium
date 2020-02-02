import ws from './ws.js';
import protectedSessionHolder from './protected_session_holder.js';
import utils from './utils.js';
import server from './server.js';
import treeCache from './tree_cache.js';
import toastService from "./toast.js";
import treeBuilder from "./tree_builder.js";
import hoistedNoteService from '../services/hoisted_note.js';
import optionsService from "../services/options.js";
import bundle from "./bundle.js";
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
    const noteTitle = await getNoteTitle(node.data.noteId);
    const branch = treeCache.getBranch(node.data.branchId);

    const prefix = branch.prefix;

    const title = (prefix ? (prefix + " - ") : "") + noteTitle;

    node.setTitle(utils.escapeHtml(title));
}

// FIXME: unused?
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
        // FIXME
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
        const noteId = getNoteIdFromNotePath(notePath);

        if (noteId && await treeCache.noteExists(noteId)) {
            for (const tab of openTabs) {
                tab.active = false;
            }

            const foundTab = openTabs.find(tab => noteId === getNoteIdFromNotePath(tab.notePath));

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
        const noteId = getNoteIdFromNotePath(openTab.notePath);

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
        const tabContext = appContext.openEmptyTab();
        tabContext.setNote(tab.notePath);

        if (tab.active) {
            appContext.activateTab(tabContext.tabId);
        }
    }

    // previous opening triggered task to save tab changes but these are bogus changes (this is init)
    // so we'll cancel it
    appContext.clearOpenTabsTask();

    setFrontendAsLoaded();
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

    if (extraOptions.saveSelection && utils.isCKEditorInitialized()) {
        [extraOptions.title, extraOptions.content] = parseSelectedHtml(window.cutToNote.getSelectedHtml());
    }

    const newNoteName = extraOptions.title || "new note";

    const {note, branch} = await server.post(`notes/${parentNoteId}/children?target=${target}&targetBranchId=${node.data.branchId}`, {
        title: newNoteName,
        content: extraOptions.content || "",
        isProtected: extraOptions.isProtected,
        type: extraOptions.type
    });

    if (extraOptions.saveSelection && utils.isCKEditorInitialized()) {
        // we remove the selection only after it was saved to server to make sure we don't lose anything
        window.cutToNote.removeSelection();
    }

    noteDetailService.addDetailLoadedListener(note.noteId, () => appContext.trigger('focusAndSelectTitle'));

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

        await appContext.getMainNoteTree().updateNode(newParentNode);
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
       appContext.activateOrOpenNote(message.noteId);

       if (utils.isElectron()) {
           const currentWindow = require("electron").remote.getCurrentWindow();

           currentWindow.show();
       }
   }
});

$(window).on('hashchange', function() {
    if (isNotePathInAddress()) {
        const [notePath, tabId] = getHashValueFromAddress();

        appContext.switchToTab(tabId, notePath);
    }
});

async function duplicateNote(noteId, parentNoteId) {
    const {note} = await server.post(`notes/${noteId}/duplicate/${parentNoteId}`);

    await ws.waitForMaxKnownSyncId();

    await appContext.activateOrOpenNote(note.noteId);

    const origNote = await treeCache.getNote(noteId);
    toastService.showMessage(`Note "${origNote.title}" has been duplicated`);
}

async function getParentProtectedStatus(node) {
    return await hoistedNoteService.isRootNode(node) ? 0 : node.getParent().data.isProtected;
}

function getNoteIdFromNotePath(notePath) {
    if (!notePath) {
        return null;
    }

    const path = notePath.split("/");

    const lastSegment = path[path.length - 1];

    // path could have also tabId suffix
    return lastSegment.split("-")[0];
}

function getNoteIdAndParentIdFromNotePath(notePath) {
    let parentNoteId = 'root';
    let noteId = '';

    if (notePath) {
        const path = notePath.split("/");

        const lastSegment = path[path.length - 1];

        // path could have also tabId suffix
        noteId = lastSegment.split("-")[0];

        if (path.length > 1) {
            parentNoteId = path[path.length - 2];
        }
    }

    return {
        parentNoteId,
        noteId
    }
}

async function getNotePath(node) {
    if (!node) {
        console.error("Node is null");
        return "";
    }

    const path = [];

    while (node && !await hoistedNoteService.isRootNode(node)) {
        if (node.data.noteId) {
            path.push(node.data.noteId);
        }

        node = node.getParent();
    }

    if (node) { // null node can happen directly after unhoisting when tree is still hoisted but option has been changed already
        path.push(node.data.noteId); // root or hoisted noteId
    }

    return path.reverse().join("/");
}

async function getNoteTitle(noteId, parentNoteId = null) {
    utils.assertArguments(noteId);

    const note = await treeCache.getNote(noteId);
    if (!note) {
        return "[not found]";
    }

    let {title} = note;

    if (parentNoteId !== null) {
        const branchId = note.parentToBranch[parentNoteId];

        if (branchId) {
            const branch = treeCache.getBranch(branchId);

            if (branch && branch.prefix) {
                title = branch.prefix + ' - ' + title;
            }
        }
    }

    return title;
}

async function getNotePathTitle(notePath) {
    utils.assertArguments(notePath);

    const titlePath = [];

    if (notePath.startsWith('root/')) {
        notePath = notePath.substr(5);
    }

    // special case when we want just root's title
    if (notePath === 'root') {
        return await getNoteTitle(notePath);
    }

    let parentNoteId = 'root';

    for (const noteId of notePath.split('/')) {
        titlePath.push(await getNoteTitle(noteId, parentNoteId));

        parentNoteId = noteId;
    }

    return titlePath.join(' / ');
}

frontendLoaded.then(bundle.executeStartupBundles);

export default {
    setProtected,
    activateNote,
    setPrefix,
    createNote,
    sortAlphabetically,
    treeInitialized,
    resolveNotePath,
    getSomeNotePath,
    createNewTopLevelNote,
    duplicateNote,
    getRunPath,
    setNodeTitleWithPrefix,
    getParentProtectedStatus,
    getNotePath,
    getNoteIdFromNotePath,
    getNoteIdAndParentIdFromNotePath,
    getNoteTitle,
    getNotePathTitle
};