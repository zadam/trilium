import noteDetailService from "./note_detail.js";
import treeChangesService from "./branches.js";
import treeService from "./tree.js";
import hoistedNoteService from "./hoisted_note.js";
import clipboard from "./clipboard.js";
import utils from "./utils.js";
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
    "DeleteNotes": node => {
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
    "AddNoteBelowToSelection": () => {
        const node = treeService.getFocusedNode();

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
    }
};

async function getKeyboardBindings() {
    const bindings = Object.assign({}, fixedKeyBindings);

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