import appContext from "./app_context.js";
import noteCreateService from "../services/note_create.js";
import treeService from "../services/tree.js";
import hoistedNoteService from "../services/hoisted_note.js";
import Component from "./component.js";

/**
 * This class contains command executors which logically belong to the NoteTree widget, but for better user experience
 * the keyboard shortcuts must be active on the whole screen and not just on the widget itself, so the executors
 * must be at the root of the component tree.
 */
export default class MainTreeExecutors extends Component {
    get tree() {
        return appContext.noteTreeWidget;
    }

    async cloneNotesToCommand() {
        const selectedOrActiveNoteIds = this.tree.getSelectedOrActiveNodes().map(node => node.data.noteId);

        this.triggerCommand('cloneNoteIdsTo', {noteIds: selectedOrActiveNoteIds});
    }

    async moveNotesToCommand() {
        const selectedOrActiveBranchIds = this.tree.getSelectedOrActiveNodes().map(node => node.data.branchId);

        this.triggerCommand('moveBranchIdsTo', {branchIds: selectedOrActiveBranchIds});
    }

    async createNoteIntoCommand() {
        const activeNoteContext = appContext.tabManager.getActiveContext();

        if (!activeNoteContext) {
            return;
        }

        await noteCreateService.createNote(activeNoteContext.notePath, {
            isProtected: activeNoteContext.note.isProtected,
            saveSelection: false
        });
    }

    async createNoteAfterCommand() {
        const node = this.tree.getActiveNode();

        if (!node) {
            return;
        }

        const parentNotePath = treeService.getNotePath(node.getParent());
        const isProtected = await treeService.getParentProtectedStatus(node);

        if (node.data.noteId === 'root' || node.data.noteId === hoistedNoteService.getHoistedNoteId()) {
            return;
        }

        await noteCreateService.createNote(parentNotePath, {
            target: 'after',
            targetBranchId: node.data.branchId,
            isProtected: isProtected,
            saveSelection: false
        });
    }
}
