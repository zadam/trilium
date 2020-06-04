import appContext from "./app_context.js";
import noteCreateService from "./note_create.js";
import treeService from "./tree.js";
import hoistedNoteService from "./hoisted_note.js";
import Component from "../widgets/component.js";
import ws from "./ws.js";

/**
 * This class contains command executors which logically belong to the NoteTree widget, but for better user experience
 * the keyboard shortcuts must be active on the whole screen and not just on the widget itself, so the executors
 * must be at the root of the component tree.
 */
export default class MainTreeExecutors extends Component {
    get tree() {
        return appContext.mainTreeWidget;
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
        const activeNote = appContext.tabManager.getActiveTabNote();

        if (!activeNote) {
            return;
        }

        await noteCreateService.createNote(activeNote.noteId, {
            isProtected: activeNote.isProtected,
            saveSelection: false
        });
    }

    async createNoteAfterCommand() {
        const node = this.tree.getActiveNode();
        const parentNoteId = node.data.parentNoteId;
        const isProtected = await treeService.getParentProtectedStatus(node);

        if (node.data.noteId === 'root' || node.data.noteId === hoistedNoteService.getHoistedNoteId()) {
            return;
        }

        await noteCreateService.createNote(parentNoteId, {
            target: 'after',
            targetBranchId: node.data.branchId,
            isProtected: isProtected,
            saveSelection: false
        });
    }
}
