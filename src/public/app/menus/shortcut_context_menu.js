import treeService from '../services/tree.js';
import froca from "../services/froca.js";
import noteCreateService from "../services/note_create.js";
import contextMenu from "./context_menu.js";
import appContext from "../services/app_context.js";

export default class ShortcutContextMenu {
    /**
     * @param {NoteTreeWidget} treeWidget
     * @param {FancytreeNode} node
     */
    constructor(treeWidget, node) {
        this.treeWidget = treeWidget;
        this.node = node;
    }

    async show(e) {
        contextMenu.show({
            x: e.pageX,
            y: e.pageY,
            items: await this.getMenuItems(),
            selectMenuItemHandler: (item, e) => this.selectMenuItemHandler(item, e)
        })
    }

    async getMenuItems() {
        const note = await froca.getNote(this.node.data.noteId);
        const isLbRoot = note.noteId === 'lb_root';
        const isVisibleRoot = note.noteId === 'lb_visibleshortcuts';
        const isAvailableRoot = note.noteId === 'lb_availableshortcuts';
        const isVisibleItem = this.node.getParent().data.noteId === 'lb_visibleshortcuts';
        const isAvailableItem = this.node.getParent().data.noteId === 'lb_availableshortcuts';
        const isItem = isVisibleItem || isAvailableItem;

        return [
            (isVisibleRoot || isAvailableRoot) ? { title: 'Add note shortcut', command: 'addNoteShortcut', uiIcon: "bx bx-plus" } : null,
            (isVisibleRoot || isAvailableRoot) ? { title: 'Add widget shortcut', command: 'addWidgetShortcut', uiIcon: "bx bx-plus" } : null,
            (isVisibleRoot || isAvailableRoot) ? { title: 'Add spacer', command: 'addSpacerShortcut', uiIcon: "bx bx-plus" } : null,
            (isVisibleRoot || isAvailableRoot) ? { title: "----" } : null,
            { title: 'Delete <kbd data-command="deleteNotes"></kbd>', command: "deleteNotes", uiIcon: "bx bx-trash",
                enabled: !isLbRoot}, // allow everything to be deleted as a form of a reset. Root can't be deleted because it's a hoisted note
            { title: "----" },
            isAvailableItem ? { title: 'Move to visible shortcuts', command: "moveShortcutToVisible", uiIcon: "bx bx-show", enabled: true } : null,
            isVisibleItem ? { title: 'Move to available shortcuts', command: "moveShortcutToAvailable", uiIcon: "bx bx-hide", enabled: true } : null,
            { title: `Duplicate shortcut <kbd data-command="duplicateSubtree">`, command: "duplicateSubtree", uiIcon: "bx bx-empty",
                enabled: isItem }
        ].filter(row => row !== null);
    }

    async selectMenuItemHandler({command}) {
        this.treeWidget.triggerCommand(command, {
            node: this.node,
            notePath: treeService.getNotePath(this.node),
            selectedOrActiveBranchIds: this.treeWidget.getSelectedOrActiveBranchIds(this.node),
            selectedOrActiveNoteIds: this.treeWidget.getSelectedOrActiveNoteIds(this.node)
        });
    }
}
