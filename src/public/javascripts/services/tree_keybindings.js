import treeChangesService from "./branches.js";
import treeService from "./tree.js";
import hoistedNoteService from "./hoisted_note.js";
import clipboard from "./clipboard.js";
import utils from "./utils.js";
import keyboardActionService from "./keyboard_actions.js";
import appContext from "./app_context.js";

/**
 * @param {NoteTreeWidget} treeWidget
 */
function getFixedKeyBindings(treeWidget) {
    return {
        // code below shouldn't be necessary normally, however there's some problem with interaction with context menu plugin
        // after opening context menu, standard shortcuts don't work, but they are detected here
        // so we essentially takeover the standard handling with our implementation.
        "left": node => {
            node.navigate($.ui.keyCode.LEFT, true).then(treeWidget.clearSelectedNodes);

            return false;
        },
        "right": node => {
            node.navigate($.ui.keyCode.RIGHT, true).then(treeWidget.clearSelectedNodes);

            return false;
        },
        "up": node => {
            node.navigate($.ui.keyCode.UP, true).then(treeWidget.clearSelectedNodes);

            return false;
        },
        "down": node => {
            node.navigate($.ui.keyCode.DOWN, true).then(treeWidget.clearSelectedNodes);

            return false;
        }
    };
}

/**
 * @param {NoteTreeWidget} treeWidget
 * @param {FancytreeNode} node
 */
function getSelectedOrActiveBranchIds(treeWidget, node) {
    const nodes = treeWidget.getSelectedOrActiveNodes(node);

    return nodes.map(node => node.data.branchId);
}

/**
 * @param {NoteTreeWidget} treeWidget
 */
function getTemplates(treeWidget) {
    return {
        "deleteNotes": node => {
            const branchIds = getSelectedOrActiveBranchIds(treeWidget, node);

            treeChangesService.deleteNotes(treeWidget, branchIds);
        },
        "moveNoteUp": node => {
            const beforeNode = node.getPrevSibling();

            if (beforeNode !== null) {
                treeChangesService.moveBeforeBranch([node.data.branchId], beforeNode.data.branchId);
            }

            return false;
        },
        "moveNoteDown": node => {
            const afterNode = node.getNextSibling();
            if (afterNode !== null) {
                treeChangesService.moveAfterBranch([node.data.branchId], afterNode.data.branchId);
            }

            return false;
        },
        "moveNoteUpInHierarchy": node => {
            treeChangesService.moveNodeUpInHierarchy(node);

            return false;
        },
        "moveNoteDownInHierarchy": node => {
            const toNode = node.getPrevSibling();

            if (toNode !== null) {
                treeChangesService.moveToParentNote([node.data.branchId], toNode.data.noteId);
            }

            return false;
        },
        "addNoteAboveToSelection": () => {
            const node = treeWidget.getFocusedNode();

            if (!node) {
                return;
            }

            if (node.isActive()) {
                node.setSelected(true);
            }

            const prevSibling = node.getPrevSibling();

            if (prevSibling) {
                prevSibling.setActive(true, {noEvents: true});

                if (prevSibling.isSelected()) {
                    node.setSelected(false);
                }

                prevSibling.setSelected(true);
            }

            return false;
        },
        "addNoteBelowToSelection": () => {
            const node = treeWidget.getFocusedNode();

            if (!node) {
                return;
            }

            if (node.isActive()) {
                node.setSelected(true);
            }

            const nextSibling = node.getNextSibling();

            if (nextSibling) {
                nextSibling.setActive(true, {noEvents: true});

                if (nextSibling.isSelected()) {
                    node.setSelected(false);
                }

                nextSibling.setSelected(true);
            }

            return false;
        },
        "collapseSubtree": node => {
            treeWidget.collapseTree(node);
        },
        "sortChildNotes": node => {
            treeService.sortAlphabetically(node.data.noteId);

            return false;
        },
        "selectAllNotesInParent": node => {
            for (const child of node.getParent().getChildren()) {
                child.setSelected(true);
            }

            return false;
        },
        "copyNotesToClipboard": node => {
            clipboard.copy(getSelectedOrActiveBranchIds(treeWidget, node));

            return false;
        },
        "cutNotesToClipboard": node => {
            clipboard.cut(getSelectedOrActiveBranchIds(treeWidget, node));

            return false;
        },
        "pasteNotesFromClipboard": node => {
            clipboard.pasteInto(node.data.noteId);

            return false;
        },
        "editNoteTitle": node => {
            appContext.trigger('focusOnTitle');

            return false;
        },
        "activateParentNote": node => {
            if (!hoistedNoteService.isRootNode(node)) {
                node.getParent().setActive().then(treeWidget.clearSelectedNodes);
            }
        }
    };
}

/**
 * @param {NoteTreeWidget} treeWidget
 */
async function getKeyboardBindings(treeWidget) {
    const bindings = Object.assign({}, getFixedKeyBindings(treeWidget));

    const templates = getTemplates(treeWidget);

    for (const actionName in templates) {
        const action = await keyboardActionService.getAction(actionName);

        for (const shortcut of action.effectiveShortcuts || []) {
            const normalizedShortcut = utils.normalizeShortcut(shortcut);

            bindings[normalizedShortcut] = templates[actionName];
        }
    }

    return bindings;
}

export default {
    getKeyboardBindings
};