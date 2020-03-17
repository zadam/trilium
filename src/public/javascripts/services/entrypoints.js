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

        const {note} = await server.post(`notes/${todayNote.noteId}/children?target=into`, {
            title: 'new note',
            content: '',
            type: 'text',
            isProtected: todayNote.isProtected
        });

        await treeService.expandToNote(note.noteId);

        const tabContext = await appContext.tabManager.openTabWithNote(note.noteId, true);

        appContext.triggerCommand('focusAndSelectTitle');
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
        window.history.back();
    }

    forwardInNoteHistoryCommand() {
        window.history.forward();
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

    async cloneNotesToCommand() {
        const selectedOrActiveNoteIds = appContext.mainTreeWidget.getSelectedOrActiveNodes().map(node => node.data.noteId);

        this.triggerCommand('cloneNoteIdsTo', {noteIds: selectedOrActiveNoteIds});
    }

    async moveNotesToCommand() {
        const selectedOrActiveBranchIds = appContext.mainTreeWidget.getSelectedOrActiveNodes().map(node => node.data.branchId);

        this.triggerCommand('moveBranchIdsTo', {branchIds: selectedOrActiveBranchIds});
    }

    async createNoteIntoCommand() {
        const note = appContext.tabManager.getActiveTabNote();

        if (note) {
            await noteCreateService.createNote(note.noteId, {
                isProtected: note.isProtected,
                saveSelection: false
            });
        }
    }
}
