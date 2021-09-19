import utils from "./utils.js";
import dateNoteService from "./date_notes.js";
import protectedSessionHolder from './protected_session_holder.js';
import server from "./server.js";
import appContext from "./app_context.js";
import Component from "../widgets/component.js";
import toastService from "./toast.js";
import noteCreateService from "./note_create.js";
import ws from "./ws.js";
import bundleService from "./bundle.js";

export default class Entrypoints extends Component {
    constructor() {
        super();

        if (jQuery.hotkeys) {
            // hot keys are active also inside inputs and content editables
            jQuery.hotkeys.options.filterInputAcceptingElements = false;
            jQuery.hotkeys.options.filterContentEditable = false;
            jQuery.hotkeys.options.filterTextInputs = false;
        }

        $(document).on('click', "a[data-action='note-revision']", async event => {
            const linkEl = $(event.target);
            const noteId = linkEl.attr('data-note-path');
            const noteRevisionId = linkEl.attr('data-note-revision-id');

            const attributesDialog = await import("../dialogs/note_revisions.js");

            attributesDialog.showNoteRevisionsDialog(noteId, noteRevisionId);

            return false;
        });
    }

    openDevToolsCommand() {
        if (utils.isElectron()) {
            utils.dynamicRequire('electron').remote.getCurrentWindow().toggleDevTools();
        }
    }

    findInTextCommand() {
        if (!utils.isElectron()) {
            return;
        }

        const {remote} = utils.dynamicRequire('electron');
        const {FindInPage} = utils.dynamicRequire('electron-find');
        const findInPage = new FindInPage(remote.getCurrentWebContents(), {
            offsetTop: 10,
            offsetRight: 10,
            boxBgColor: 'var(--main-background-color)',
            boxShadowColor: '#000',
            inputColor: 'var(--input-text-color)',
            inputBgColor: 'var(--input-background-color)',
            inputFocusColor: '#555',
            textColor: 'var(--main-text-color)',
            textHoverBgColor: '#555',
            caseSelectedColor: 'var(--main-border-color)'
        });

        findInPage.openFindWindow();
    }

    async createNoteIntoInboxCommand() {
        const inboxNote = await dateNoteService.getInboxNote();

        const {note} = await server.post(`notes/${inboxNote.noteId}/children?target=into`, {
            title: 'new note',
            content: '',
            type: 'text',
            isProtected: inboxNote.isProtected && protectedSessionHolder.isProtectedSessionAvailable()
        });

        await ws.waitForMaxKnownEntityChangeId();

        const hoistedNoteId = appContext.tabManager.getActiveTabContext()
            ? appContext.tabManager.getActiveTabContext().hoistedNoteId
            : 'root';

        await appContext.tabManager.openTabWithNote(note.noteId, true, null, hoistedNoteId);

        appContext.triggerEvent('focusAndSelectTitle');
    }

    async toggleNoteHoistingCommand() {
        const tabContext = appContext.tabManager.getActiveTabContext();

        if (tabContext.note.noteId === tabContext.hoistedNoteId) {
            await tabContext.unhoist();
        }
        else if (tabContext.note.type !== 'search') {
            await tabContext.setHoistedNoteId(tabContext.note.noteId);
        }
    }

    async hoistNoteCommand({noteId}) {
        const tabContext = appContext.tabManager.getActiveTabContext();

        if (tabContext.hoistedNoteId !== noteId) {
            await tabContext.setHoistedNoteId(noteId);
        }
    }

    async unhoistCommand() {
        const activeTabContext = appContext.tabManager.getActiveTabContext();

        if (activeTabContext) {
            activeTabContext.unhoist();
        }
    }

    copyWithoutFormattingCommand() {
        utils.copySelectionToClipboard();
    }

    toggleFullscreenCommand() {
        if (utils.isElectron()) {
            const win = utils.dynamicRequire('electron').remote.getCurrentWindow();

            if (win.isFullScreenable()) {
                win.setFullScreen(!win.isFullScreen());
            }
        }
        else {
            // outside of electron this is handled by the browser
            this.$widget.find(".toggle-fullscreen-button").hide();
        }
    }

    reloadFrontendAppCommand() {
        utils.reloadApp();
    }

    logoutCommand() {
        const $logoutForm = $('<form action="logout" method="POST">')
            .append($(`<input type="hidden" name="_csrf" value="${glob.csrfToken}"/>`));

        $("body").append($logoutForm);
        $logoutForm.trigger('submit');
    }

    backInNoteHistoryCommand() {
        if (utils.isElectron()) {
            // standard JS version does not work completely correctly in electron
            const webContents = utils.dynamicRequire('electron').remote.getCurrentWebContents();
            const activeIndex = parseInt(webContents.getActiveIndex());

            webContents.goToIndex(activeIndex - 1);
        }
        else {
            window.history.back();
        }
    }

    forwardInNoteHistoryCommand() {
        if (utils.isElectron()) {
            // standard JS version does not work completely correctly in electron
            const webContents = utils.dynamicRequire('electron').remote.getCurrentWebContents();
            const activeIndex = parseInt(webContents.getActiveIndex());

            webContents.goToIndex(activeIndex + 1);
        }
        else {
            window.history.forward();
        }
    }

    async switchToDesktopVersionCommand() {
        utils.setCookie('trilium-device', 'desktop');

        utils.reloadApp();
    }

    async openInWindowCommand({notePath, hoistedNoteId}) {
        if (!hoistedNoteId) {
            hoistedNoteId = 'root';
        }

        if (utils.isElectron()) {
            const {ipcRenderer} = utils.dynamicRequire('electron');

            ipcRenderer.send('create-extra-window', {notePath, hoistedNoteId});
        }
        else {
            const url = window.location.protocol + '//' + window.location.host + window.location.pathname + '?extra=1#' + notePath;

            window.open(url, '', 'width=1000,height=800');
        }
    }

    async openNewWindowCommand() {
        this.openInWindowCommand({notePath: '', hoistedNoteId: 'root'});
    }

    async runActiveNoteCommand() {
        const tabContext = appContext.tabManager.getActiveTabContext();
        const note = tabContext.note;

        // ctrl+enter is also used elsewhere so make sure we're running only when appropriate
        if (!note || note.type !== 'code') {
            return;
        }

        // TODO: use note.executeScript()
        if (note.mime.endsWith("env=frontend")) {
            await bundleService.getAndExecuteBundle(note.noteId);
        } else if (note.mime.endsWith("env=backend")) {
            await server.post('script/run/' + note.noteId);
        } else if (note.mime === 'text/x-sqlite;schema=trilium') {
            const result = await server.post("sql/execute/" + note.noteId);

            this.triggerEvent('sqlQueryResults', {tabId: tabContext.tabId, results: result.results});
        }

        toastService.showMessage("Note executed");
    }

    hideAllTooltips() {
        $(".tooltip").removeClass("show");
    }

    tabNoteSwitchedEvent() {
        this.hideAllTooltips();
    }

    activeTabChangedEvent() {
        this.hideAllTooltips();
    }
}
