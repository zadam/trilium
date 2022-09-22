import Component from "../widgets/component.js";
import appContext from "./app_context.js";
import dateNoteService from "../services/date_notes.js";
import treeService from "../services/tree.js";
import openService from "./open.js";
import protectedSessionService from "./protected_session.js";
import options from "./options.js";
import froca from "./froca.js";

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
}
