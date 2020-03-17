import utils from "./utils.js";
import treeService from "./tree.js";
import dateNoteService from "./date_notes.js";
import hoistedNoteService from "./hoisted_note.js";
import treeCache from "./tree_cache.js";
import server from "./server.js";
import appContext from "./app_context.js";
import Component from "../widgets/component.js";
import toastService from "./toast.js";
import noteCreateService from "./note_create.js";
import ws from "./ws.js";

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
            require('electron').remote.getCurrentWindow().toggleDevTools();
        }
    }

    findInTextCommand() {
        if (!utils.isElectron()) {
            return;
        }

        const {remote} = require('electron');
        const {FindInPage} = require('electron-find');
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

    async createNoteIntoDayNoteCommand() {
        const todayNote = await dateNoteService.getTodayNote();

        const {note} = await noteCreateService.createNote(todayNote.noteId, {
            isProtected: todayNote.isProtected,
            type: 'text',
            title: 'new note',
            content: ''
        });

        await ws.waitForMaxKnownSyncId();

        await appContext.tabManager.openTabWithNote(note.noteId, false);

        appContext.triggerEvent('focusAndSelectTitle');
    }

    async toggleNoteHoistingCommand() {
        const note = appContext.tabManager.getActiveTabNote();

        const hoistedNoteId = hoistedNoteService.getHoistedNoteId();
        if (note.noteId === hoistedNoteId) {
            hoistedNoteService.unhoist();
        }
        else if (note.type !== 'search') {
            hoistedNoteService.setHoistedNoteId(note.noteId);
        }
    }

    copyWithoutFormattingCommand() {
        utils.copySelectionToClipboard();
    }

    toggleFullscreenCommand() {
        if (utils.isElectron()) {
            const win = require('electron').remote.getCurrentWindow();

            if (win.isFullScreenable()) {
                win.setFullScreen(!win.isFullScreen());
            }
        }
        else {
            // outside of electron this is handled by the browser
            this.$widget.find(".toggle-fullscreen-button").hide();
        }
    }

    toggleZenModeCommand() {
        if (!this.zenModeActive) {
            $(".hide-in-zen-mode,.gutter").addClass("hidden-by-zen-mode");
            $("#root-widget").addClass("zen-mode");
            this.zenModeActive = true;
        }
        else {
            // not hiding / showing explicitly since element might be hidden also for other reasons
            $(".hide-in-zen-mode,.gutter").removeClass("hidden-by-zen-mode");
            $("#root-widget").removeClass("zen-mode");
            this.zenModeActive = false;
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
            const webContents = require('electron').remote.getCurrentWebContents();
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
            const webContents = require('electron').remote.getCurrentWebContents();
            const activeIndex = parseInt(webContents.getActiveIndex());

            webContents.goToIndex(activeIndex + 1);
        }
        else {
            window.history.forward();
        }
    }

    async searchForResultsCommand({searchText}) {
        const response = await server.get('search/' + encodeURIComponent(searchText));

        if (!response.success) {
            toastService.showError("Search failed.", 3000);
            return;
        }

        this.triggerEvent('searchResults', {results: response.results});

        // have at least some feedback which is good especially in situations
        // when the result list does not change with a query
        toastService.showMessage("Search finished successfully.");
    }

    async switchToDesktopVersionCommand() {
        utils.setCookie('trilium-device', 'desktop');

        utils.reloadApp();
    }

    createTopLevelNoteCommand() { noteCreateService.createNewTopLevelNote(); }
}
