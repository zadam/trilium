import Component from "../widgets/component.js";
import appContext from "./app_context.js";
import dateNoteService from "../services/date_notes.js";
import treeService from "../services/tree.js";
import openService from "./open.js";
import protectedSessionService from "./protected_session.js";
import options from "./options.js";
import froca from "./froca.js";

export default class RootCommandExecutor extends Component {
    jumpToNoteCommand() {
        import("../dialogs/jump_to_note.js").then(d => d.showDialog());
    }

    showRecentChangesCommand() {
        import("../dialogs/recent_changes.js").then(d => d.showDialog());
    }

    showNoteRevisionsCommand() {
        import("../dialogs/note_revisions.js").then(d => d.showCurrentNoteRevisions());
    }

    showNoteSourceCommand() {
        import("../dialogs/note_source.js").then(d => d.showDialog());
    }

    pasteMarkdownIntoTextCommand() {
        import("../dialogs/markdown_import.js").then(d => d.importMarkdownInline());
    }

    async editBranchPrefixCommand() {
        const notePath = appContext.tabManager.getActiveContextNotePath();

        if (notePath) {
            const editBranchPrefixDialog = await import("../dialogs/branch_prefix.js");
            editBranchPrefixDialog.showDialog(notePath);
        }
    }

    editReadOnlyNoteCommand() {
        const noteContext = appContext.tabManager.getActiveContext();
        noteContext.readOnlyTemporarilyDisabled = true;

        appContext.triggerEvent("readOnlyTemporarilyDisabled", { noteContext });
    }

    async cloneNoteIdsToCommand({noteIds}) {
        const d = await import("../dialogs/clone_to.js");
        d.showDialog(noteIds);
    }

    async moveBranchIdsToCommand({branchIds}) {
        const d = await import("../dialogs/move_to.js");
        d.showDialog(branchIds);
    }

    showOptionsCommand({openTab}) {
        import("../dialogs/options.js").then(d => d.showDialog(openTab));
    }

    showHelpCommand() {
        import("../dialogs/help.js").then(d => d.showDialog());
    }

    async showSQLConsoleCommand() {
        const sqlConsoleNote = await dateNoteService.createSqlConsole();

        const noteContext = await appContext.tabManager.openContextWithNote(sqlConsoleNote.noteId, true);

        appContext.triggerEvent('focusOnDetail', {ntxId: noteContext.ntxId});
    }

    async searchNotesCommand({searchString, ancestorNoteId}) {
        const searchNote = await dateNoteService.createSearchNote({searchString, ancestorNoteId});

        // force immediate search
        await froca.loadSearchNote(searchNote.noteId);

        const activeNoteContext = appContext.tabManager.getActiveContext();
        const hoistedNoteId = activeNoteContext?.hoistedNoteId || 'root';

        const noteContext = await appContext.tabManager.openContextWithNote(searchNote.noteId, true, null, hoistedNoteId);

        appContext.triggerCommand('focusOnSearchDefinition', {ntxId: noteContext.ntxId});
    }

    async searchInSubtreeCommand({notePath}) {
        const noteId = treeService.getNoteIdFromNotePath(notePath);

        this.searchNotesCommand({ancestorNoteId: noteId});
    }

    showBackendLogCommand() {
        import("../dialogs/backend_log.js").then(d => d.showDialog());
    }

    openNoteExternallyCommand() {
        const noteId = appContext.tabManager.getActiveContextNoteId();

        if (noteId) {
            openService.openNoteExternally(noteId);
        }
    }

    enterProtectedSessionCommand() {
        protectedSessionService.enterProtectedSession();
    }

    leaveProtectedSessionCommand() {
        protectedSessionService.leaveProtectedSession();
    }

    hideLeftPaneCommand() {
        options.save(`leftPaneVisible`, "false");
    }

    showLeftPaneCommand() {
        options.save(`leftPaneVisible`, "true");
    }

    toggleLeftPaneCommand() {
        options.toggle('leftPaneVisible');
    }
}
