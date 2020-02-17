import Component from "../widgets/component.js";
import appContext from "./app_context.js";

export default class DialogCommandExecutor extends Component {
    jumpToNoteCommand() {
        import("../dialogs/jump_to_note.js").then(d => d.showDialog());
    }

    showRecentChangesCommand() {
        import("../dialogs/recent_changes.js").then(d => d.showDialog());
    }

    showAttributesCommand() {
        import("../dialogs/attributes.js").then(d => d.showDialog());
    }

    showNoteInfoCommand() {
        import("../dialogs/note_info.js").then(d => d.showDialog());
    }

    showNoteRevisionsCommand() {
        import("../dialogs/note_revisions.js").then(d => d.showCurrentNoteRevisions());
    }

    showNoteSourceCommand() {
        import("../dialogs/note_source.js").then(d => d.showDialog());
    }

    showLinkMapCommand() {
        import("../dialogs/link_map.js").then(d => d.showDialog());
    }

    pasteMarkdownIntoTextCommand() {
        import("../dialogs/markdown_import.js").then(d => d.importMarkdownInline());
    }

    async editBranchPrefixCommand() {
        const notePath = appContext.tabManager.getActiveTabNotePath();

        if (notePath) {
            const editBranchPrefixDialog = await import("../dialogs/branch_prefix.js");
            editBranchPrefixDialog.showDialog(notePath);
        }
    }

    async cloneNoteIdsToCommand({noteIds}) {
        const d = await import("../dialogs/clone_to.js");
        d.showDialog(noteIds);
    }

    async moveBranchIdsToCommand({branchIds}) {
        const d = await import("../dialogs/move_to.js");
        d.showDialog(branchIds);
    }

    showOptionsCommand() {
        import("../dialogs/options.js").then(d => d.showDialog())
    }

    showHelpCommand() {
        import("../dialogs/help.js").then(d => d.showDialog())
    }

    showSQLConsoleCommand() {
        import("../dialogs/sql_console.js").then(d => d.showDialog())
    }

    showBackendLogCommand() {
        import("../dialogs/backend_log.js").then(d => d.showDialog())
    }
}