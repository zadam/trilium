import utils from "./utils.js";
import treeService from "./tree.js";
import dateNoteService from "./date_notes.js";
import hoistedNoteService from "./hoisted_note.js";
import treeCache from "./tree_cache.js";
import server from "./server.js";
import appContext from "./app_context.js";
import Component from "../widgets/component.js";

export default class Entrypoints extends Component {
    constructor(appContext, parent) {
        super(appContext, parent);

        // hot keys are active also inside inputs and content editables
        jQuery.hotkeys.options.filterInputAcceptingElements = false;
        jQuery.hotkeys.options.filterContentEditable = false;
        jQuery.hotkeys.options.filterTextInputs = false;

        $(document).on('click', "a[data-action='note-revision']", async event => {
            const linkEl = $(event.target);
            const noteId = linkEl.attr('data-note-path');
            const noteRevisionId = linkEl.attr('data-note-revision-id');

            const attributesDialog = await import("../dialogs/note_revisions.js");

            attributesDialog.showNoteRevisionsDialog(noteId, noteRevisionId);

            return false;
        });
    }

    openDevToolsEvent() {
        if (utils.isElectron()) {
            require('electron').remote.getCurrentWindow().toggleDevTools();
        }
    }

    findInTextEvent() {
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
    }



    async createNoteIntoDayNoteEvent() {
        const todayNote = await dateNoteService.getTodayNote();

        const {note} = await server.post(`notes/${todayNote.noteId}/children?target=into`, {
            title: 'new note',
            content: '',
            type: 'text',
            isProtected: todayNote.isProtected
        });

        await treeService.expandToNote(note.noteId);

        const tabContext = appContext.tabManager.openEmptyTab();
        appContext.tabManager.activateTab(tabContext.tabId);
        await tabContext.setNote(note.noteId);

        appContext.triggerEvent('focusAndSelectTitle');
    }

    async toggleNoteHoistingEvent() {
        const note = appContext.tabManager.getActiveTabNote();

        const hoistedNoteId = hoistedNoteService.getHoistedNoteId();
        if (note.noteId === hoistedNoteId) {
            hoistedNoteService.unhoist();
        }
        else {
            const note = await treeCache.getNote(note.noteId);

            if (note.type !== 'search') {
                hoistedNoteService.setHoistedNoteId(note.noteId);
            }
        }
    }

    copyWithoutFormattingEvent() {
        utils.copySelectionToClipboard();
    }

    toggleFullscreenEvent() {
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

    toggleZenModeEvent() {
        if (!this.zenModeActive) {
            $(".hide-in-zen-mode,.gutter").addClass("hidden-by-zen-mode");
            $("#container").addClass("zen-mode");
            this.zenModeActive = true;
        }
        else {
            // not hiding / showing explicitly since element might be hidden also for other reasons
            $(".hide-in-zen-mode,.gutter").removeClass("hidden-by-zen-mode");
            $("#container").removeClass("zen-mode");
            this.zenModeActive = false;
        }
    }

    reloadFrontendAppEvent() {
        utils.reloadApp();
    }

    logoutEvent() {
        const $logoutForm = $('<form action="logout" method="POST">')
            .append($(`<input type="hidden" name="_csrf" value="${glob.csrfToken}"/>`));

        $("body").append($logoutForm);
        $logoutForm.trigger('submit');
    }

    showOptionsEvent() {
        import("../dialogs/options.js").then(d => d.showDialog())
    }

    showHelpEvent() {
        import("../dialogs/help.js").then(d => d.showDialog())
    }

    showSQLConsoleEvent() {
        import("../dialogs/sql_console.js").then(d => d.showDialog())
    }

    showBackendLogEvent() {
        import("../dialogs/backend_log.js").then(d => d.showDialog())
    }

    backInNoteHistoryEvent() {
        window.history.back();
    }

    forwardInNoteHistoryEvent() {
        window.history.forward();
    }
}
