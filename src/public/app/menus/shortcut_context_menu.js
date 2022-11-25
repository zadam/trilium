import treeService from '../services/tree.js';
import froca from "../services/froca.js";
import contextMenu from "./context_menu.js";
import dialogService from "../services/dialog.js";
import server from "../services/server.js";

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
        const parentNoteId = this.node.getParent().data.noteId;

        const isVisibleRoot = note.noteId === 'lb_visibleshortcuts';
        const isAvailableRoot = note.noteId === 'lb_availableshortcuts';
        const isVisibleItem = parentNoteId === 'lb_visibleshortcuts';
        const isAvailableItem = parentNoteId === 'lb_availableshortcuts';
        const isItem = isVisibleItem || isAvailableItem;
        const canBeDeleted = !note.noteId.startsWith("lb_");
        const canBeReset = note.noteId.startsWith("lb_");

        return [
            (isVisibleRoot || isAvailableRoot) ? { title: 'Add note shortcut', command: 'addNoteShortcut', uiIcon: "bx bx-plus" } : null,
            (isVisibleRoot || isAvailableRoot) ? { title: 'Add script shortcut', command: 'addScriptShortcut', uiIcon: "bx bx-plus" } : null,
            (isVisibleRoot || isAvailableRoot) ? { title: 'Add widget shortcut', command: 'addWidgetShortcut', uiIcon: "bx bx-plus" } : null,
            (isVisibleRoot || isAvailableRoot) ? { title: 'Add spacer', command: 'addSpacerShortcut', uiIcon: "bx bx-plus" } : null,
            (isVisibleRoot || isAvailableRoot) ? { title: "----" } : null,
            { title: 'Delete <kbd data-command="deleteNotes"></kbd>', command: "deleteNotes", uiIcon: "bx bx-trash", enabled: canBeDeleted },
            { title: 'Reset', command: "resetShortcut", uiIcon: "bx bx-empty", enabled: canBeReset},
            { title: "----" },
            isAvailableItem ? { title: 'Move to visible shortcuts', command: "moveShortcutToVisible", uiIcon: "bx bx-show", enabled: true } : null,
            isVisibleItem ? { title: 'Move to available shortcuts', command: "moveShortcutToAvailable", uiIcon: "bx bx-hide", enabled: true } : null,
            { title: `Duplicate shortcut <kbd data-command="duplicateSubtree">`, command: "duplicateSubtree", uiIcon: "bx bx-empty",
                enabled: isItem }
        ].filter(row => row !== null);
    }

    async selectMenuItemHandler({command}) {
        if (command === 'resetShortcut') {
            const confirmed = await dialogService.confirm(`Do you really want to reset "${this.node.title}"? 
                       All data / settings in this shortcut (and its children) will be lost 
                       and the shortcut will be returned to its original location.`);

            if (confirmed) {
                await server.post(`special-notes/shortcuts/${this.node.data.noteId}/reset`);
            }

            return;
        }

        this.treeWidget.triggerCommand(command, {
            node: this.node,
            notePath: treeService.getNotePath(this.node),
            selectedOrActiveBranchIds: this.treeWidget.getSelectedOrActiveBranchIds(this.node),
            selectedOrActiveNoteIds: this.treeWidget.getSelectedOrActiveNoteIds(this.node)
        });
    }
}
