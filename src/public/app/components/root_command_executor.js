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
        noteContext.viewScope.readOnlyTemporarilyDisabled = true;

        appContext.triggerEvent("readOnlyTemporarilyDisabled", { noteContext });
    }

    async showSQLConsoleCommand() {
        const sqlConsoleNote = await dateNoteService.createSqlConsole();

        const noteContext = await appContext.tabManager.openContextWithNote(sqlConsoleNote.noteId, { activate: true });

        appContext.triggerEvent('focusOnDetail', {ntxId: noteContext.ntxId});
    }

    async searchNotesCommand({searchString, ancestorNoteId}) {
        const searchNote = await dateNoteService.createSearchNote({searchString, ancestorNoteId});

        // force immediate search
        await froca.loadSearchNote(searchNote.noteId);

        const activeNoteContext = appContext.tabManager.getActiveContext();
        const hoistedNoteId = activeNoteContext?.hoistedNoteId || 'root';

        const noteContext = await appContext.tabManager.openContextWithNote(searchNote.noteId, {
            activate: true,
            hoistedNoteId
        });

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

    async showBackendLogCommand() {
        await appContext.tabManager.openContextWithNote('_backendLog', { activate: true });
    }

    async showLaunchBarSubtreeCommand() {
        await this.showAndHoistSubtree('_lbRoot');
    }

    async showShareSubtreeCommand() {
        await this.showAndHoistSubtree('_share');
    }

    async showHiddenSubtreeCommand() {
        await this.showAndHoistSubtree('_hidden');
    }

    async showOptionsCommand({section}) {
        await appContext.tabManager.openContextWithNote(section || '_options', {
            activate: true,
            hoistedNoteId: '_options'
        });
    }

    async showSQLConsoleHistoryCommand() {
        await this.showAndHoistSubtree('_sqlConsole');
    }

    async showSearchHistoryCommand() {
        await this.showAndHoistSubtree('_search');
    }

    async showAndHoistSubtree(subtreeNoteId) {
        await appContext.tabManager.openContextWithNote(subtreeNoteId, {
            activate: true,
            hoistedNoteId: subtreeNoteId
        });
    }

    async showNoteSourceCommand() {
        const notePath = appContext.tabManager.getActiveContextNotePath();

        if (notePath) {
            await appContext.tabManager.openContextWithNote(notePath, { activate: true, viewMode: 'source' });
        }
    }
}
