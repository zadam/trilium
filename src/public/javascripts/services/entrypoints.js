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

const NOTE_REVISIONS = "../dialogs/note_revisions.js";
const OPTIONS = "../dialogs/options.js";
const ADD_LINK = "../dialogs/add_link.js";
const JUMP_TO_NOTE = "../dialogs/jump_to_note.js";
const NOTE_SOURCE = "../dialogs/note_source.js";
const RECENT_CHANGES = "../dialogs/recent_changes.js";
const SQL_CONSOLE = "../dialogs/sql_console.js";
const BACKEND_LOG = "../dialogs/backend_log.js";
const ATTRIBUTES = "../dialogs/attributes.js";
const HELP = "../dialogs/help.js";
const NOTE_INFO = "../dialogs/note_info.js";
const ABOUT = "../dialogs/about.js";
const LINK_MAP = "../dialogs/link_map.js";
const CLONE_TO = "../dialogs/clone_to.js";
const MOVE_TO = "../dialogs/move_to.js";

function registerEntrypoints() {
    // hot keys are active also inside inputs and content editables
    jQuery.hotkeys.options.filterInputAcceptingElements = false;
    jQuery.hotkeys.options.filterContentEditable = false;
    jQuery.hotkeys.options.filterTextInputs = false;

    keyboardActionService.setGlobalActionHandler('SearchNotes', searchNotesService.toggleSearch);

    const $noteTabContainer = $("#note-tab-container");

    keyboardActionService.setGlobalActionHandler("InsertDateTimeToText", () => {
        const date = new Date();
        const dateString = utils.formatDateTime(date);

        linkService.addTextToEditor(dateString);
    });

    if (utils.isElectron()) {
        const openDevTools = () => {
            require('electron').remote.getCurrentWindow().toggleDevTools();

            return false;
        };

        $("#open-dev-tools-button").on('click', openDevTools);
        keyboardActionService.setGlobalActionHandler("OpenDevTools", openDevTools);
    }

    let findInPage;

    if (utils.isElectron()) {
        const { remote } = require('electron');
        const { FindInPage } = require('electron-find');

        findInPage = new FindInPage(remote.getCurrentWebContents(), {
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

    if (utils.isElectron()) {
        keyboardActionService.setGlobalActionHandler("ZoomOut", zoomService.decreaseZoomFactor);
        keyboardActionService.setGlobalActionHandler("ZoomIn", zoomService.increaseZoomFactor);
    }

    $(document).on('click', "a[data-action='note-revision']", async event => {
        const linkEl = $(event.target);
        const noteId = linkEl.attr('data-note-path');
        const noteRevisionId = linkEl.attr('data-note-revision-id');

        const attributesDialog = await import("../dialogs/note_revisions.js");

        attributesDialog.showNoteRevisionsDialog(noteId, noteRevisionId);

        return false;
    });

    keyboardActionService.setGlobalActionHandler("CreateNoteIntoDayNote", async () => {
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
    });

    keyboardActionService.setGlobalActionHandler("ToggleNoteHoisting", async () => {
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
    });

    keyboardActionService.setGlobalActionHandler("SearchInSubtree",  () => {
        const node = appContext.getMainNoteTree().getActiveNode();

        searchNotesService.searchInSubtree(node.data.noteId);
    });

    keyboardActionService.setGlobalActionHandler('CollapseTree', () => appContext.getMainNoteTree().collapseTree());

    keyboardActionService.setGlobalActionHandler("CopyWithoutFormatting", utils.copySelectionToClipboard);
}

export default {
    registerEntrypoints
}