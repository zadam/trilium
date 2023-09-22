import Component from "./component.js";
import appContext from "./app_context.js";
import dateNoteService from "../services/date_notes.js";
import treeService from "../services/tree.js";
import openService from "../services/open.js";
import protectedSessionService from "../services/protected_session.js";
import options from "../services/options.js";
import froca from "../services/froca.js";
import utils from "../services/utils.js";

export default class RootCommandExecutor extends Component {
    editReadOnlyNoteCommand() {
        const noteContext = appContext.tabManager.getActiveContext();
        noteContext.viewScope.readOnlyTemporarilyDisabled = true;

        appContext.triggerEvent("readOnlyTemporarilyDisabled", { noteContext });
    }

    async showSQLConsoleCommand() {
        const sqlConsoleNote = await dateNoteService.createSqlConsole();

        const noteContext = await appContext.tabManager.openTabWithNoteWithHoisting(sqlConsoleNote.noteId, { activate: true });

        appContext.triggerEvent('focusOnDetail', {ntxId: noteContext.ntxId});
    }

    async searchNotesCommand({searchString, ancestorNoteId}) {
        const searchNote = await dateNoteService.createSearchNote({searchString, ancestorNoteId});

        // force immediate search
        await froca.loadSearchNote(searchNote.noteId);

        const noteContext = await appContext.tabManager.openTabWithNoteWithHoisting(searchNote.noteId, {
            activate: true
        });

        appContext.triggerCommand('focusOnSearchDefinition', {ntxId: noteContext.ntxId});
    }

    async searchInSubtreeCommand({notePath}) {
        const noteId = treeService.getNoteIdFromUrl(notePath);

        this.searchNotesCommand({ancestorNoteId: noteId});
    }

    openNoteExternallyCommand() {
        const noteId = appContext.tabManager.getActiveContextNoteId();
        const mime = appContext.tabManager.getActiveContextNoteMime();
        if (noteId) {
            openService.openNoteExternally(noteId, mime);
        }
    }

    openNoteCustomCommand() {
        const noteId = appContext.tabManager.getActiveContextNoteId();
        const mime = appContext.tabManager.getActiveContextNoteMime();
        if (noteId) {
            openService.openNoteCustom(noteId, mime);
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
        await appContext.tabManager.openTabWithNoteWithHoisting('_backendLog', { activate: true });
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
            await appContext.tabManager.openTabWithNoteWithHoisting(notePath, {
                activate: true,
                viewScope: {
                    viewMode: 'source'
                }
            });
        }
    }

    async showAttachmentsCommand() {
        const notePath = appContext.tabManager.getActiveContextNotePath();

        if (notePath) {
            await appContext.tabManager.openTabWithNoteWithHoisting(notePath, {
                activate: true,
                viewScope: {
                    viewMode: 'attachments'
                }
            });
        }
    }

    async showAttachmentDetailCommand() {
        const notePath = appContext.tabManager.getActiveContextNotePath();

        if (notePath) {
            await appContext.tabManager.openTabWithNoteWithHoisting(notePath, {
                activate: true,
                viewScope: {
                    viewMode: 'attachments'
                }
            });
        }
    }

    toggleTrayCommand() {
        if (!utils.isElectron()) return;
        const {BrowserWindow} = utils.dynamicRequire('@electron/remote');
        const windows = BrowserWindow.getAllWindows();
        const isVisible = windows.every(w => w.isVisible());
        const action = isVisible ? "hide" : "show"
        for (const window of windows) window[action]();
    }

    firstTabCommand()   { this.#goToTab(1); }
    secondTabCommand()  { this.#goToTab(2); }
    thirdTabCommand()   { this.#goToTab(3); }
    fourthTabCommand()  { this.#goToTab(4); }
    fifthTabCommand()   { this.#goToTab(5); }
    sixthTabCommand()   { this.#goToTab(6); }
    seventhTabCommand() { this.#goToTab(7); }
    eigthTabCommand()   { this.#goToTab(8); }
    ninthTabCommand()   { this.#goToTab(9); }
    lastTabCommand()    { this.#goToTab(Number.POSITIVE_INFINITY); }

    #goToTab(tabNumber) {
        const mainNoteContexts = appContext.tabManager.getMainNoteContexts();

        const index = tabNumber === Number.POSITIVE_INFINITY ? mainNoteContexts.length - 1 : tabNumber - 1;
        const tab = mainNoteContexts[index];

        if (tab) {
            appContext.tabManager.activateNoteContext(tab.ntxId);
        }
    }
}
