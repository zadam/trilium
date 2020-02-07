import Component from "../widgets/component.js";

export default class DialogEventComponent extends Component {
    jumpToNoteListener() {
        import("../dialogs/jump_to_note.js").then(d => d.showDialog());
    }

    showRecentChangesListener() {
        import("../dialogs/recent_changes.js").then(d => d.showDialog());
    }

    showAttributesListener() {
        import("../dialogs/attributes.js").then(d => d.showDialog());
    }

    showNoteInfoListener() {
        import("../dialogs/note_info.js").then(d => d.showDialog());
    }

    showNoteRevisionsListener() {
        import("../dialogs/note_revisions.js").then(d => d.showCurrentNoteRevisions());
    }

    showNoteSourceListener() {
        import("../dialogs/note_source.js").then(d => d.showDialog());
    }

    showLinkMapListener() {
        import("../dialogs/link_map.js").then(d => d.showDialog());
    }

    pasteMarkdownIntoTextListener() {
        import("../dialogs/markdown_import.js").then(d => d.importMarkdownInline());
    }

    async cloneNotesToListener() {
        // FIXME
        const selectedOrActiveNodes = this.appContext.getMainNoteTree().getSelectedOrActiveNodes();

        const noteIds = selectedOrActiveNodes.map(node => node.data.noteId);

        const d = await import("../dialogs/clone_to.js");
        d.showDialog(noteIds);
    }

    async moveNotesToListener() {
        // FIXME
        const selectedOrActiveNodes = this.appContext.getMainNoteTree().getSelectedOrActiveNodes();

        const d = await import("../dialogs/move_to.js");
        d.showDialog(selectedOrActiveNodes);
    }

    async editBranchPrefixListener() {
        // FIXME
        const node = this.appContext.getMainNoteTree().getActiveNode();

        const editBranchPrefixDialog = await import("../dialogs/branch_prefix.js");
        editBranchPrefixDialog.showDialog(node);
    }

    addLinkToTextListener() {
        import("../dialogs/add_link.js").then(d => d.showDialog());
    }
}