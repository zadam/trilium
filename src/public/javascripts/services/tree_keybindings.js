import noteDetailService from "./note_detail.js";
import treeChangesService from "./branches.js";
import treeService from "./tree.js";
import hoistedNoteService from "./hoisted_note.js";
import clipboard from "./clipboard.js";
import treeCache from "./tree_cache.js";
import searchNoteService from "./search_notes.js";
import keyboardActionService from "./keyboard_actions.js";

const fixedKeyBindings = {
    // code below shouldn't be necessary normally, however there's some problem with interaction with context menu plugin
    // after opening context menu, standard shortcuts don't work, but they are detected here
    // so we essentially takeover the standard handling with our implementation.
    "left": node => {
        node.navigate($.ui.keyCode.LEFT, true).then(treeService.clearSelectedNodes);

        return false;
    },
    "right": node => {
        node.navigate($.ui.keyCode.RIGHT, true).then(treeService.clearSelectedNodes);

        return false;
    },
    "up": node => {
        node.navigate($.ui.keyCode.UP, true).then(treeService.clearSelectedNodes);

        return false;
    },
    "down": node => {
        node.navigate($.ui.keyCode.DOWN, true).then(treeService.clearSelectedNodes);

        return false;
    }
};

const templates = {
    "DeleteNote": node => {
        treeChangesService.deleteNodes(treeService.getSelectedOrActiveNodes(node));
    },
    "MoveNoteUp": node => {
        const beforeNode = node.getPrevSibling();

        if (beforeNode !== null) {
            treeChangesService.moveBeforeNode([node], beforeNode);
        }

        return false;
    },
    "MoveNoteDown": node => {
        const afterNode = node.getNextSibling();
        if (afterNode !== null) {
            treeChangesService.moveAfterNode([node], afterNode);
        }

        return false;
    },
    "MoveNoteUpInHierarchy": node => {
        treeChangesService.moveNodeUpInHierarchy(node);

        return false;
    },
    "MoveNoteDownInHierarchy": node => {
        const toNode = node.getPrevSibling();

        if (toNode !== null) {
            treeChangesService.moveToNode([node], toNode);
        }

        return false;
    },
    "AddNoteAboveToSelection": () => {
        const node = treeService.getFocusedNode();

        if (!node) {
            return;
        }

        if (node.isActive()) {
            node.setSelected(true);
        }

        node.navigate($.ui.keyCode.UP, false).then(() => {
            const currentNode = treeService.getFocusedNode();

            if (currentNode.isSelected()) {
                node.setSelected(false);
            }

            currentNode.setSelected(true);
        });

        return false;
    },
    "AddNoteBelowToSelection": () => {
        const node = treeService.getFocusedNode();

        if (!node) {
            return;
        }

        if (node.isActive()) {
            node.setSelected(true);
        }

        node.navigate($.ui.keyCode.DOWN, false).then(() => {
            const currentNode = treeService.getFocusedNode();

            if (currentNode.isSelected()) {
                node.setSelected(false);
            }

            currentNode.setSelected(true);
        });

        return false;
    },
    // TODO: this shouldn't be tree specific shortcut
    "EditBranchPrefix": async node => {
        const editBranchPrefixDialog = await import("../dialogs/branch_prefix.js");
        editBranchPrefixDialog.showDialog(node);
    },
    "CollapseSubtree": node => {
        treeService.collapseTree(node);
    },
    "SortChildNotes": node => {
        treeService.sortAlphabetically(node.data.noteId);

        return false;
    },
    "SelectAllNotesInParent": node => {
        for (const child of node.getParent().getChildren()) {
            child.setSelected(true);
        }

        return false;
    },
    "CopyNotesToClipboard": node => {
        clipboard.copy(treeService.getSelectedOrActiveNodes(node));

        return false;
    },
    "CutNotesToClipboard": node => {
        clipboard.cut(treeService.getSelectedOrActiveNodes(node));

        return false;
    },
    "PasteNotesFromClipboard": node => {
        clipboard.pasteInto(node);

        return false;
    },
    "EditNoteTitle": node => {
        noteDetailService.focusOnTitle();

        return false;
    },
    "ActivateParentNote": async node => {
        if (!await hoistedNoteService.isRootNode(node)) {
            node.getParent().setActive().then(treeService.clearSelectedNodes);
        }
    },
    // TODO: this should probably be app-global shortcut
    "ToggleNoteHoisting": node => {
        hoistedNoteService.getHoistedNoteId().then(async hoistedNoteId => {
            if (node.data.noteId === hoistedNoteId) {
                hoistedNoteService.unhoist();
            }
            else {
                const note = await treeCache.getNote(node.data.noteId);

                if (note.type !== 'search') {
                    hoistedNoteService.setHoistedNoteId(node.data.noteId);
                }
            }
        });

        return false;
    },
    "SearchInSubtree": node => {
        searchNoteService.searchInSubtree(node.data.noteId);

        return false;
    }
};

async function getKeyboardBindings() {
    const bindings = Object.assign({}, fixedKeyBindings);

    for (const actionName in templates) {
        const action = await keyboardActionService.getAction(actionName);

        for (const shortcut of action.effectiveShortcuts || []) {
            bindings[shortcut] = templates[actionName];
        }
    }

    return bindings;
}

export default {
    getKeyboardBindings
};