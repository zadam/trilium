import contextMenuService from './context_menu.js';
import dragAndDropSetup from './drag_and_drop.js';
import linkService from './link.js';
import messagingService from './messaging.js';
import noteDetailService from './note_detail.js';
import protectedSessionHolder from './protected_session_holder.js';
import treeChangesService from './tree_changes.js';
import treeUtils from './tree_utils.js';
import utils from './utils.js';
import server from './server.js';
import recentNotesDialog from '../dialogs/recent_notes.js';
import editTreePrefixDialog from '../dialogs/edit_tree_prefix.js';
import treeCache from './tree_cache.js';
import infoService from "./info.js";
import Branch from '../entities/branch.js';

const $tree = $("#tree");
const $parentList = $("#parent-list");
const $parentListList = $("#parent-list-inner");
const $createTopLevelNoteButton = $("#create-top-level-note-button");
const $collapseTreeButton = $("#collapse-tree-button");
const $scrollToCurrentNoteButton = $("#scroll-to-current-note-button");

let startNotePath = null;

// note that if you want to access data like noteId or isProtected, you need to go into "data" property
function getCurrentNode() {
    return $tree.fancytree("getActiveNode");
}

function getCurrentNotePath() {
    const node = getCurrentNode();

    return treeUtils.getNotePath(node);
}

async function getNodesByBranchId(branchId) {
    utils.assertArguments(branchId);

    const branch = await treeCache.getBranch(branchId);

    return getNodesByNoteId(branch.noteId).filter(node => node.data.branchId === branchId);
}

function getNodesByNoteId(noteId) {
    utils.assertArguments(noteId);

    const list = getTree().getNodesByRef(noteId);
    return list ? list : []; // if no nodes with this refKey are found, fancy tree returns null
}

async function setPrefix(branchId, prefix) {
    utils.assertArguments(branchId);

    const branch = await treeCache.getBranch(branchId);

    branch.prefix = prefix;

    for (const node of await getNodesByBranchId(branchId)) {
        await setNodeTitleWithPrefix(node);
    }
}

async function setNodeTitleWithPrefix(node) {
    const noteTitle = await treeUtils.getNoteTitle(node.data.noteId);
    const branch = await treeCache.getBranch(node.data.branchId);

    const prefix = branch.prefix;

    const title = (prefix ? (prefix + " - ") : "") + noteTitle;

    node.setTitle(utils.escapeHtml(title));
}

async function prepareBranch(noteRows, branchRows) {
    utils.assertArguments(noteRows);

    treeCache.load(noteRows, branchRows);

    return await prepareBranchInner(await treeCache.getNote('root'));
}

async function getExtraClasses(note) {
    utils.assertArguments(note);

    const extraClasses = [];

    if (note.isProtected) {
        extraClasses.push("protected");
    }

    if ((await note.getParentNotes()).length > 1) {
        extraClasses.push("multiple-parents");
    }

    extraClasses.push(note.type);

    return extraClasses.join(" ");
}

async function prepareBranchInner(parentNote) {
    utils.assertArguments(parentNote);

    const childBranches = await parentNote.getChildBranches();

    if (!childBranches) {
        messagingService.logError(`No children for ${parentNote}. This shouldn't happen.`);
        return;
    }

    const noteList = [];

    for (const branch of childBranches) {
        const note = await branch.getNote();
        const title = (branch.prefix ? (branch.prefix + " - ") : "") + note.title;

        const node = {
            noteId: note.noteId,
            parentNoteId: branch.parentNoteId,
            branchId: branch.branchId,
            isProtected: note.isProtected,
            title: utils.escapeHtml(title),
            extraClasses: await getExtraClasses(note),
            refKey: note.noteId,
            expanded: note.type !== 'search' && branch.isExpanded
        };

        const hasChildren = (await note.getChildNotes()).length > 0;

        if (hasChildren || note.type === 'search') {
            node.folder = true;

            if (node.expanded && note.type !== 'search') {
                node.children = await prepareBranchInner(note);
            }
            else {
                node.lazy = true;
            }
        }

        noteList.push(node);
    }

    return noteList;
}

async function expandToNote(notePath, expandOpts) {
    utils.assertArguments(notePath);

    const runPath = await getRunPath(notePath);

    const noteId = treeUtils.getNoteIdFromNotePath(notePath);

    let parentNoteId = 'root';

    for (const childNoteId of runPath) {
        const node = getNodesByNoteId(childNoteId).find(node => node.data.parentNoteId === parentNoteId);

        if (childNoteId === noteId) {
            return node;
        }
        else {
            await node.setExpanded(true, expandOpts);
        }

        parentNoteId = childNoteId;
    }
}

async function activateNode(notePath) {
    utils.assertArguments(notePath);

    const node = await expandToNote(notePath);

    await node.setActive();

    clearSelectedNodes();
}

/**
 * Accepts notePath and tries to resolve it. Part of the path might not be valid because of note moving (which causes
 * path change) or other corruption, in that case this will try to get some other valid path to the correct note.
 */
async function getRunPath(notePath) {
    utils.assertArguments(notePath);

    const path = notePath.split("/").reverse();
    path.push('root');

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
            const parents = await child.getParentNotes();

            if (!parents) {
                messagingService.logError("No parents found for " + childNoteId);
                return;
            }

            if (!parents.some(p => p.noteId === parentNoteId)) {
                console.log(utils.now(), "Did not find parent " + parentNoteId + " for child " + childNoteId);

                if (parents.length > 0) {
                    console.log(utils.now(), "Available parents:", parents);

                    const someNotePath = await getSomeNotePath(parents[0]);

                    if (someNotePath) { // in case it's root the path may be empty
                        const pathToRoot = someNotePath.split("/").reverse();

                        for (const noteId of pathToRoot) {
                            effectivePath.push(noteId);
                        }
                    }

                    break;
                }
                else {
                    messagingService.logError("No parents, can't activate node.");
                    return;
                }
            }
        }

        if (parentNoteId === 'root') {
            break;
        }
        else {
            effectivePath.push(parentNoteId);
            childNoteId = parentNoteId;
        }
    }

    return effectivePath.reverse();
}

async function showParentList(noteId, node) {
    utils.assertArguments(noteId, node);

    const note = await treeCache.getNote(noteId);
    const parents = await note.getParentNotes();

    if (!parents.length) {
        infoService.throwError("Can't find parents for noteId=" + noteId);
    }

    if (parents.length <= 1) {
        $parentList.hide();
    }
    else {
        $parentList.show();
        $parentListList.empty();

        for (const parentNote of parents) {
            const parentNotePath = await getSomeNotePath(parentNote);
            // this is to avoid having root notes leading '/'
            const notePath = parentNotePath ? (parentNotePath + '/' + noteId) : noteId;
            const title = await treeUtils.getNotePathTitle(notePath);

            let item;

            if (node.getParent().data.noteId === parentNote.noteId) {
                item = $("<span/>").attr("title", "Current note").append(title);
            }
            else {
                item = linkService.createNoteLink(notePath, title);
            }

            $parentListList.append($("<li/>").append(item));
        }
    }
}

async function getSomeNotePath(note) {
    utils.assertArguments(note);

    const path = [];

    let cur = note;

    while (cur.noteId !== 'root') {
        path.push(cur.noteId);

        const parents = await cur.getParentNotes();

        if (!parents.length) {
            infoService.throwError("Can't find parents for " + cur);
        }

        cur = parents[0];
    }

    return path.reverse().join('/');
}

async function setExpandedToServer(branchId, isExpanded) {
    utils.assertArguments(branchId);

    const expandedNum = isExpanded ? 1 : 0;

    await server.put('tree/' + branchId + '/expanded/' + expandedNum);
}

function setCurrentNotePathToHash(node) {
    utils.assertArguments(node);

    const currentNotePath = treeUtils.getNotePath(node);
    const currentBranchId = node.data.branchId;

    document.location.hash = currentNotePath;

    recentNotesDialog.addRecentNote(currentBranchId, currentNotePath);
}

function getSelectedNodes(stopOnParents = false) {
    return getTree().getSelectedNodes(stopOnParents);
}

function clearSelectedNodes() {
    for (const selectedNode of getSelectedNodes()) {
        selectedNode.setSelected(false);
    }

    const currentNode = getCurrentNode();

    if (currentNode) {
        currentNode.setSelected(true);
    }
}

async function treeInitialized() {
    const noteId = treeUtils.getNoteIdFromNotePath(startNotePath);

    if (!await treeCache.getNote(noteId)) {
        // note doesn't exist so don't try to activate it
        startNotePath = null;
    }

    if (startNotePath) {
        activateNode(startNotePath);

        // looks like this this doesn't work when triggered immediatelly after activating node
        // so waiting a second helps
        setTimeout(scrollToCurrentNote, 1000);
    }
}

function initFancyTree(branch) {
    utils.assertArguments(branch);

    const keybindings = {
        "del": node => {
            treeChangesService.deleteNodes(getSelectedNodes(true));
        },
        "ctrl+up": node => {
            const beforeNode = node.getPrevSibling();

            if (beforeNode !== null) {
                treeChangesService.moveBeforeNode([node], beforeNode);
            }

            return false;
        },
        "ctrl+down": node => {
            let afterNode = node.getNextSibling();
            if (afterNode !== null) {
                treeChangesService.moveAfterNode([node], afterNode);
            }

            return false;
        },
        "ctrl+left": node => {
            treeChangesService.moveNodeUpInHierarchy(node);

            return false;
        },
        "ctrl+right": node => {
            let toNode = node.getPrevSibling();

            if (toNode !== null) {
                treeChangesService.moveToNode([node], toNode);
            }

            return false;
        },
        "shift+up": node => {
            node.navigate($.ui.keyCode.UP, true).then(() => {
                const currentNode = getCurrentNode();

                if (currentNode.isSelected()) {
                    node.setSelected(false);
                }

                currentNode.setSelected(true);
            });

            return false;
        },
        "shift+down": node => {
            node.navigate($.ui.keyCode.DOWN, true).then(() => {
                const currentNode = getCurrentNode();

                if (currentNode.isSelected()) {
                    node.setSelected(false);
                }

                currentNode.setSelected(true);
            });

            return false;
        },
        "f2": node => {
            editTreePrefixDialog.showDialog(node);
        },
        "alt+-": node => {
            collapseTree(node);
        },
        "alt+s": node => {
            sortAlphabetically(node.data.noteId);

            return false;
        },
        "ctrl+a": node => {
            for (const child of node.getParent().getChildren()) {
                child.setSelected(true);
            }

            return false;
        },
        "ctrl+c": () => {
            contextMenuService.copy(getSelectedNodes());

            return false;
        },
        "ctrl+x": () => {
            contextMenuService.cut(getSelectedNodes());

            return false;
        },
        "ctrl+v": node => {
            contextMenuService.pasteInto(node);

            return false;
        },
        "return": node => {
            noteDetailService.focus();

            return false;
        },
        "backspace": node => {
            if (!utils.isTopLevelNode(node)) {
                node.getParent().setActive().then(clearSelectedNodes);
            }
        },
        // code below shouldn't be necessary normally, however there's some problem with interaction with context menu plugin
        // after opening context menu, standard shortcuts don't work, but they are detected here
        // so we essentially takeover the standard handling with our implementation.
        "left": node => {
            node.navigate($.ui.keyCode.LEFT, true).then(clearSelectedNodes);

            return false;
        },
        "right": node => {
            node.navigate($.ui.keyCode.RIGHT, true).then(clearSelectedNodes);

            return false;
        },
        "up": node => {
            node.navigate($.ui.keyCode.UP, true).then(clearSelectedNodes);

            return false;
        },
        "down": node => {
            node.navigate($.ui.keyCode.DOWN, true).then(clearSelectedNodes);

            return false;
        }
    };

    $tree.fancytree({
        autoScroll: true,
        keyboard: false, // we takover keyboard handling in the hotkeys plugin
        extensions: ["hotkeys", "filter", "dnd", "clones"],
        source: branch,
        scrollParent: $("#tree"),
        click: (event, data) => {
            const targetType = data.targetType;
            const node = data.node;

            if (targetType === 'title' || targetType === 'icon') {
                if (!event.ctrlKey) {
                    node.setActive();
                    node.setSelected(true);

                    clearSelectedNodes();
                }
                else {
                    node.setSelected(!node.isSelected());
                }

                return false;
            }
        },
        activate: (event, data) => {
            const node = data.node.data;

            setCurrentNotePathToHash(data.node);

            noteDetailService.switchToNote(node.noteId);

            showParentList(node.noteId, data.node);
        },
        expand: (event, data) => {
            setExpandedToServer(data.node.data.branchId, true);
        },
        collapse: (event, data) => {
            setExpandedToServer(data.node.data.branchId, false);
        },
        init: (event, data) => {
            treeInitialized();
        },
        hotkeys: {
            keydown: keybindings
        },
        filter: {
            autoApply: true,   // Re-apply last filter if lazy data is loaded
            autoExpand: true, // Expand all branches that contain matches while filtered
            counter: false,     // Show a badge with number of matching child nodes near parent icons
            fuzzy: false,      // Match single characters in order, e.g. 'fb' will match 'FooBar'
            hideExpandedCounter: true,  // Hide counter badge if parent is expanded
            hideExpanders: false,       // Hide expanders if all child nodes are hidden by filter
            highlight: true,   // Highlight matches by wrapping inside <mark> tags
            leavesOnly: false, // Match end nodes only
            nodata: true,      // Display a 'no data' status node if result is empty
            mode: "hide"       // Grayout unmatched nodes (pass "hide" to remove unmatched node instead)
        },
        dnd: dragAndDropSetup,
        lazyLoad: function(event, data) {
            const noteId = data.node.data.noteId;
            data.result = treeCache.getNote(noteId).then(note => {
                if (note.type === 'search') {
                    return loadSearchNote(noteId);
                }
                else {
                    return prepareBranchInner(note);
                }
            });
        },
        clones: {
            highlightActiveClones: true
        }
    });

    $tree.contextmenu(contextMenuService.contextMenuSettings);
}

async function loadSearchNote(searchNoteId) {
    const searchNote = await noteDetailService.loadNote(searchNoteId);
    const noteIds = await server.get('search/' + encodeURIComponent(searchNote.jsonContent.searchString));

    for (const noteId of noteIds) {
        const branch = new Branch(treeCache, {
            branchId: "virt" + utils.randomString(10),
            noteId: noteId,
            parentNoteId: searchNoteId,
            prefix: '',
            virtual: true
        });

        treeCache.addBranch(branch);
    }

    return await prepareBranchInner(searchNote);
}

function getTree() {
    return $tree.fancytree('getTree');
}

async function reload() {
    const notes = await loadTree();

    // this will also reload the note content
    await getTree().reload(notes);
}

function getNotePathFromAddress() {
    return document.location.hash.substr(1); // strip initial #
}

async function loadTree() {
    const resp = await server.get('tree');
    startNotePath = resp.start_note_path;
    window.glob.instanceName = resp.instanceName;

    if (document.location.hash) {
        startNotePath = getNotePathFromAddress();
    }

    return await prepareBranch(resp.notes, resp.branches);
}

function collapseTree(node = null) {
    if (!node) {
        node = $tree.fancytree("getRootNode");
    }

    node.setExpanded(false);

    node.visit(node => node.setExpanded(false));
}

function scrollToCurrentNote() {
    const node = getCurrentNode();

    if (node) {
        node.makeVisible({scrollIntoView: true});

        node.setFocus();
    }
}

function setBranchBackgroundBasedOnProtectedStatus(noteId) {
    getNodesByNoteId(noteId).map(node => node.toggleClass("protected", !!node.data.isProtected));
}

function setProtected(noteId, isProtected) {
    getNodesByNoteId(noteId).map(node => node.data.isProtected = isProtected);

    setBranchBackgroundBasedOnProtectedStatus(noteId);
}

async function setNoteTitle(noteId, title) {
    utils.assertArguments(noteId);

    const note = await treeCache.getNote(noteId);

    note.title = title;

    for (const clone of getNodesByNoteId(noteId)) {
        await setNodeTitleWithPrefix(clone);
    }
}

async function createNewTopLevelNote() {
    const rootNode = $tree.fancytree("getRootNode");

    await createNote(rootNode, "root", "into");
}

async function createNote(node, parentNoteId, target, isProtected) {
    utils.assertArguments(node, parentNoteId, target);

    // if isProtected isn't available (user didn't enter password yet), then note is created as unencrypted
    // but this is quite weird since user doesn't see WHERE the note is being created so it shouldn't occur often
    if (!isProtected || !protectedSessionHolder.isProtectedSessionAvailable()) {
        isProtected = false;
    }

    const newNoteName = "new note";

    const result = await server.post('notes/' + parentNoteId + '/children', {
        title: newNoteName,
        target: target,
        target_branchId: node.data.branchId,
        isProtected: isProtected
    });

    const note = new NoteShort(treeCache, {
        noteId: result.noteId,
        title: result.title,
        isProtected: result.isProtected,
        type: result.type,
        mime: result.mime
    });

    const branch = new Branch(treeCache, result);

    treeCache.add(note, branch);

    noteDetailService.newNoteCreated();

    const newNode = {
        title: newNoteName,
        noteId: result.noteId,
        parentNoteId: parentNoteId,
        refKey: result.noteId,
        branchId: result.branchId,
        isProtected: isProtected,
        extraClasses: await getExtraClasses(note)
    };

    if (target === 'after') {
        await node.appendSibling(newNode).setActive(true);
    }
    else if (target === 'into') {
        if (!node.getChildren() && node.isFolder()) {
            await node.setExpanded();
        }
        else {
            node.addChildren(newNode);
        }

        await node.getLastChild().setActive(true);

        node.folder = true;
        node.renderTitle();
    }
    else {
        infoService.throwError("Unrecognized target: " + target);
    }

    clearSelectedNodes(); // to unmark previously active node

    infoService.showMessage("Created!");
}

async function sortAlphabetically(noteId) {
    await server.put('notes/' + noteId + '/sort');

    await reload();
}

async function showTree() {
    const tree = await loadTree();

    initFancyTree(tree);
}

messagingService.subscribeToMessages(syncData => {
    if (syncData.some(sync => sync.entityName === 'branches')
        || syncData.some(sync => sync.entityName === 'notes')) {

        console.log(utils.now(), "Reloading tree because of background changes");

        reload();
    }
});

utils.bindShortcut('ctrl+o', () => {
    const node = getCurrentNode();
    const parentNoteId = node.data.parentNoteId;
    const isProtected = treeUtils.getParentProtectedStatus(node);

    createNote(node, parentNoteId, 'after', isProtected);
});

utils.bindShortcut('ctrl+p', () => {
    const node = getCurrentNode();

    createNote(node, node.data.noteId, 'into', node.data.isProtected);
});

utils.bindShortcut('ctrl+del', () => {
    const node = getCurrentNode();

    treeChangesService.deleteNodes([node]);
});

utils.bindShortcut('ctrl+.', scrollToCurrentNote);

$(window).bind('hashchange', function() {
    const notePath = getNotePathFromAddress();

    if (getCurrentNotePath() !== notePath) {
        console.log("Switching to " + notePath + " because of hash change");

        activateNode(notePath);
    }
});

utils.bindShortcut('alt+c', () => collapseTree()); // don't use shortened form since collapseTree() accepts argument

$createTopLevelNoteButton.click(createNewTopLevelNote);
$collapseTreeButton.click(collapseTree);
$scrollToCurrentNoteButton.click(scrollToCurrentNote);

export default {
    reload,
    collapseTree,
    scrollToCurrentNote,
    setBranchBackgroundBasedOnProtectedStatus,
    setProtected,
    expandToNote,
    activateNode,
    getCurrentNode,
    getCurrentNotePath,
    setCurrentNotePathToHash,
    setNoteTitle,
    setPrefix,
    createNewTopLevelNote,
    createNote,
    getSelectedNodes,
    sortAlphabetically,
    showTree
};