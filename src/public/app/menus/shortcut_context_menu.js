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
        const branch = froca.getBranch(this.node.data.branchId);
        const isVisibleRoot = note.noteId === 'lb_visibleshortcuts';
        const isAvailableRoot = note.noteId === 'lb_availableshortcuts';
        const isVisibleItem = this.node.getParent().data.noteId === 'lb_visibleshortcuts';
        const isAvailableItem = this.node.getParent().data.noteId === 'lb_availableshortcuts';
        const isItem = isVisibleItem || isAvailableItem;

        return [
            (isVisibleRoot || isAvailableRoot) ? { title: 'Add note shortcut', command: 'addNoteShortcut' } : null,
            (isVisibleRoot || isAvailableRoot) ? { title: 'Add widget shortcut', command: 'addWidgetShortcut' } : null,
            (isVisibleRoot || isAvailableRoot) ? { title: 'Add spacer', command: 'addSpacerShortcut' } : null,
            { title: "----" },
            { title: 'Delete <kbd data-command="deleteNotes"></kbd>', command: "deleteNotes", uiIcon: "bx bx-trash",
                enabled: isItem },
            { title: "----" },
            isAvailableItem ? { title: 'Move to visible shortcuts', command: "moveNotesTo", uiIcon: "bx bx-empty", enabled: true } : null,
            isVisibleItem ? { title: 'Move to available shortcuts', command: "moveNotesTo", uiIcon: "bx bx-empty", enabled: true } : null,
            { title: `Duplicate shortcut <kbd data-command="duplicateSubtree">`, command: "duplicateSubtree", uiIcon: "bx bx-empty",
                enabled: isItem }
        ].filter(row => row !== null);
    }

    async selectMenuItemHandler({command, type, templateNoteId}) {
        const notePath = treeService.getNotePath(this.node);

        if (command === 'openInTab') {
            appContext.tabManager.openTabWithNoteWithHoisting(notePath);
        }
        else if (command === "insertNoteAfter") {
            const parentNotePath = treeService.getNotePath(this.node.getParent());
            const isProtected = await treeService.getParentProtectedStatus(this.node);

            noteCreateService.createNote(parentNotePath, {
                target: 'after',
                targetBranchId: this.node.data.branchId,
                type: type,
                isProtected: isProtected,
                templateNoteId: templateNoteId
            });
        }
        else if (command === "insertChildNote") {
            const parentNotePath = treeService.getNotePath(this.node);

            noteCreateService.createNote(parentNotePath, {
                type: type,
                isProtected: this.node.data.isProtected,
                templateNoteId: templateNoteId
            });
        }
        else if (command === 'openNoteInSplit') {
            const subContexts = appContext.tabManager.getActiveContext().getSubContexts();
            const {ntxId} = subContexts[subContexts.length - 1];

            this.treeWidget.triggerCommand("openNewNoteSplit", {ntxId, notePath});
        }
        else {
            this.treeWidget.triggerCommand(command, {
                node: this.node,
                notePath: notePath,
                selectedOrActiveBranchIds: this.treeWidget.getSelectedOrActiveBranchIds(this.node),
                selectedOrActiveNoteIds: this.treeWidget.getSelectedOrActiveNoteIds(this.node)
            });
        }
    }
}
