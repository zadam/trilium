import utils from "./utils.js";
import linkService from "./link.js";
import zoomService from "./zoom.js";
import protectedSessionService from "./protected_session.js";
import searchNotesService from "./search_notes.js";
import treeService from "./tree.js";
import dateNoteService from "./date_notes.js";
import noteDetailService from "./note_detail.js";
import keyboardActionService from "./keyboard_actions.js";
import hoistedNoteService from "./hoisted_note.js";
import treeCache from "./tree_cache.js";
import server from "./server.js";
import appContext from "./app_context.js";
import Component from "../widgets/component.js";

export default class Entrypoints extends Component {
    constructor(appContext) {
        super(appContext);

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

    openDevToolsListener() {
        if (utils.isElectron()) {
            require('electron').remote.getCurrentWindow().toggleDevTools();
        }
    }


    findInTextListener() {
        if (utils.isElectron()) {
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

            keyboardActionService.setGlobalActionHandler("FindInText", () => {
                if (!glob.activeDialog || !glob.activeDialog.is(":visible")) {
                    findInPage.openFindWindow();
                }
            });
        }
    }

    zoomOutListener() {
        zoomService.decreaseZoomFactor();
    }

    zoomInListener() {
        zoomService.increaseZoomFactor();
    }

    async createNoteIntoDayNoteListener() {
        const todayNote = await dateNoteService.getTodayNote();

        const {note} = await server.post(`notes/${todayNote.noteId}/children?target=into`, {
            title: 'new note',
            content: '',
            type: 'text',
            isProtected: todayNote.isProtected
        });

        await treeService.expandToNote(note.noteId);

        await noteDetailService.openInTab(note.noteId, true);

        noteDetailService.focusAndSelectTitle();
    }

    toggleNoteHoistingListener() {
        const node = appContext.getMainNoteTree().getActiveNode();

        hoistedNoteService.getHoistedNoteId().then(async hoistedNoteId => {
            if (node.data.noteId === hoistedNoteId) {
                hoistedNoteService.unhoist();
            }
            else {
                const note = await treeCache.getNote(node.data.noteId);

                if (note.type !== 'search') {
                    hoistedNoteService.setHoistedNoteId(node.data.noteId);
                }
            }
        });
    }

    copyWithoutFormattingListener() {
        utils.copySelectionToClipboard();
    }
}