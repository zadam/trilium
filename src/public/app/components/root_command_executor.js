import Component from "./component.js";
import appContext from "./app_context.js";
import dateNoteService from "../services/date_notes.js";
import treeService from "../services/tree.js";
import openService from "../services/open.js";
import protectedSessionService from "../services/protected_session.js";
import options from "../services/options.js";
import froca from "../services/froca.js";

export default class RootCommandExecutor extends Component {
    editReadOnlyNoteCommand() {
        const noteContext = appContext.tabManager.getActiveContext();
        noteContext.readOnlyTemporarilyDisabled = true;

        appContext.triggerEvent("readOnlyTemporarilyDisabled", { noteContext });
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

    openNoteExternallyCommand() {
        const noteId = appContext.tabManager.getActiveContextNoteId();
        const mime = appContext.tabManager.getActiveContextNoteMime()

        if (noteId) {
            openService.openNoteExternally(noteId, mime);
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

    async showLaunchBarSubtreeCommand() {
        await appContext.tabManager.openContextWithNote('lbRoot', true, null, 'lbRoot');
    }

    async showShareSubtreeCommand() {
        await appContext.tabManager.openContextWithNote('share', true, null, 'share');
    }

    async showHiddenSubtreeCommand() {
        await appContext.tabManager.openContextWithNote('hidden', true, null, 'hidden');
    }

    async showOptionsCommand() {
        await appContext.tabManager.openContextWithNote('options', true, null, 'opt_root')
    }
}
