import treeService from '../services/tree.js';
import froca from "../services/froca.js";
import contextMenu from "./context_menu.js";
import dialogService from "../services/dialog.js";
import server from "../services/server.js";

export default class LauncherContextMenu {
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
            selectMenuItemHandler: (item, e) => this.selectMenuItemHandler(item)
        })
    }

    async getMenuItems() {
        const note = await froca.getNote(this.node.data.noteId);
        const parentNoteId = this.node.getParent().data.noteId;

        const isVisibleRoot = note.noteId === '_lbVisibleLaunchers';
        const isAvailableRoot = note.noteId === '_lbAvailableLaunchers';
        const isVisibleItem = parentNoteId === '_lbVisibleLaunchers';
        const isAvailableItem = parentNoteId === '_lbAvailableLaunchers';
        const isItem = isVisibleItem || isAvailableItem;
        const canBeDeleted = !note.noteId.startsWith("_"); // fixed notes can't be deleted
        const canBeReset = !canBeDeleted && note.isLaunchBarConfig();;

        return [
            (isVisibleRoot || isAvailableRoot) ? { title: 'Add a note launcher', command: 'addNoteLauncher', uiIcon: "bx bx-plus" } : null,
            (isVisibleRoot || isAvailableRoot) ? { title: 'Add a script launcher', command: 'addScriptLauncher', uiIcon: "bx bx-plus" } : null,
            (isVisibleRoot || isAvailableRoot) ? { title: 'Add a custom widget', command: 'addWidgetLauncher', uiIcon: "bx bx-plus" } : null,
            (isVisibleRoot || isAvailableRoot) ? { title: 'Add spacer', command: 'addSpacerLauncher', uiIcon: "bx bx-plus" } : null,
            (isVisibleRoot || isAvailableRoot) ? { title: "----" } : null,
            { title: 'Delete <kbd data-command="deleteNotes"></kbd>', command: "deleteNotes", uiIcon: "bx bx-trash", enabled: canBeDeleted },
            { title: 'Reset', command: "resetLauncher", uiIcon: "bx bx-empty", enabled: canBeReset},
            { title: "----" },
            isAvailableItem ? { title: 'Move to visible launchers', command: "moveLauncherToVisible", uiIcon: "bx bx-show", enabled: true } : null,
            isVisibleItem ? { title: 'Move to available launchers', command: "moveLauncherToAvailable", uiIcon: "bx bx-hide", enabled: true } : null,
            { title: `Duplicate launcher <kbd data-command="duplicateSubtree">`, command: "duplicateSubtree", uiIcon: "bx bx-empty",
                enabled: isItem }
        ].filter(row => row !== null);
    }

    async selectMenuItemHandler({command}) {
        if (command === 'resetLauncher') {
            const confirmed = await dialogService.confirm(`Do you really want to reset "${this.node.title}"? 
                       All data / settings in this note (and its children) will be lost 
                       and the launcher will be returned to its original location.`);

            if (confirmed) {
                await server.post(`special-notes/launchers/${this.node.data.noteId}/reset`);
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
