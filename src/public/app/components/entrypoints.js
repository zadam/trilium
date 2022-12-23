import utils from "../services/utils.js";
import dateNoteService from "../services/date_notes.js";
import protectedSessionHolder from '../services/protected_session_holder.js';
import server from "../services/server.js";
import appContext from "./app_context.js";
import Component from "./component.js";
import toastService from "../services/toast.js";
import ws from "../services/ws.js";
import bundleService from "../services/bundle.js";
import froca from "../services/froca.js";

export default class Entrypoints extends Component {
    constructor() {
        super();

        if (jQuery.hotkeys) {
            // hot keys are active also inside inputs and content editables
            jQuery.hotkeys.options.filterInputAcceptingElements = false;
            jQuery.hotkeys.options.filterContentEditable = false;
            jQuery.hotkeys.options.filterTextInputs = false;
        }
    }

    openDevToolsCommand() {
        if (utils.isElectron()) {
            utils.dynamicRequire('@electron/remote').getCurrentWindow().toggleDevTools();
        }
    }

    async createNoteIntoInboxCommand() {
        const inboxNote = await dateNoteService.getInboxNote();

        const {note} = await server.post(`notes/${inboxNote.noteId}/children?target=into`, {
            content: '',
            type: 'text',
            isProtected: inboxNote.isProtected && protectedSessionHolder.isProtectedSessionAvailable()
        });

        await ws.waitForMaxKnownEntityChangeId();

        await appContext.tabManager.openTabWithNoteWithHoisting(note.noteId, true);

        appContext.triggerEvent('focusAndSelectTitle', {isNewNote: true});
    }

    async toggleNoteHoistingCommand({noteId = appContext.tabManager.getActiveContextNoteId()}) {
        const noteToHoist = await froca.getNote(noteId);
        const activeNoteContext = appContext.tabManager.getActiveContext();

        if (noteToHoist.noteId === activeNoteContext.hoistedNoteId) {
            await activeNoteContext.unhoist();
        }
        else if (noteToHoist.type !== 'search') {
            await activeNoteContext.setHoistedNoteId(noteId);
        }
    }

    async hoistNoteCommand({noteId}) {
        const noteContext = appContext.tabManager.getActiveContext();

        if (noteContext.hoistedNoteId !== noteId) {
            await noteContext.setHoistedNoteId(noteId);
        }
    }

    async unhoistCommand() {
        const activeNoteContext = appContext.tabManager.getActiveContext();

        if (activeNoteContext) {
            activeNoteContext.unhoist();
        }
    }

    copyWithoutFormattingCommand() {
        utils.copySelectionToClipboard();
    }

    toggleFullscreenCommand() {
        if (utils.isElectron()) {
            const win = utils.dynamicRequire('@electron/remote').getCurrentWindow();

            if (win.isFullScreenable()) {
                win.setFullScreen(!win.isFullScreen());
            }
        } // outside of electron this is handled by the browser
    }

    reloadFrontendAppCommand() {
        utils.reloadFrontendApp();
    }

    logoutCommand() {
        const $logoutForm = $('<form action="logout" method="POST">')
            .append($(`<input type='_hidden' name="_csrf" value="${glob.csrfToken}"/>`));

        $("body").append($logoutForm);
        $logoutForm.trigger('submit');
    }

    backInNoteHistoryCommand() {
        if (utils.isElectron()) {
            // standard JS version does not work completely correctly in electron
            const webContents = utils.dynamicRequire('@electron/remote').getCurrentWebContents();
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
            const webContents = utils.dynamicRequire('@electron/remote').getCurrentWebContents();
            const activeIndex = parseInt(webContents.getActiveIndex());

            webContents.goToIndex(activeIndex + 1);
        }
        else {
            window.history.forward();
        }
    }

    async switchToDesktopVersionCommand() {
        utils.setCookie('trilium-device', 'desktop');

        utils.reloadFrontendApp("Switching to desktop version");
    }

    async switchToMobileVersionCommand() {
        utils.setCookie('trilium-device', 'mobile');

        utils.reloadFrontendApp("Switching to mobile version");
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
            const url = `${window.location.protocol}//${window.location.host}${window.location.pathname}?extra=1#${notePath}`;

            window.open(url, '', 'width=1000,height=800');
        }
    }

    async openNewWindowCommand() {
        this.openInWindowCommand({notePath: '', hoistedNoteId: 'root'});
    }

    async runActiveNoteCommand() {
        const {ntxId, note} = appContext.tabManager.getActiveContext();

        // ctrl+enter is also used elsewhere so make sure we're running only when appropriate
        if (!note || note.type !== 'code') {
            return;
        }

        // TODO: use note.executeScript()
        if (note.mime.endsWith("env=frontend")) {
            await bundleService.getAndExecuteBundle(note.noteId);
        } else if (note.mime.endsWith("env=backend")) {
            await server.post(`script/run/${note.noteId}`);
        } else if (note.mime === 'text/x-sqlite;schema=trilium') {
            const resp = await server.post(`sql/execute/${note.noteId}`);

            if (!resp.success) {
                toastService.showError(`Error occurred while executing SQL query: ${resp.message}`);
            }

            await appContext.triggerEvent('sqlQueryResults', {ntxId: ntxId, results: resp.results});
        }

        toastService.showMessage("Note executed");
    }

    hideAllPopups() {
        $(".tooltip").removeClass("show");

        if (utils.isDesktop()) {
            $(".aa-input").autocomplete("close");
        }
    }

    noteSwitchedEvent() {
        this.hideAllPopups();
    }

    activeContextChangedEvent() {
        this.hideAllPopups();
    }

    async forceSaveNoteRevisionCommand() {
        const noteId = appContext.tabManager.getActiveContextNoteId();

        await server.post(`notes/${noteId}/revision`);

        toastService.showMessage("Note revision has been created.");
    }
}
