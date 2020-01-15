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

    keyboardActionService.setGlobalActionHandler("AddLinkToText", () => import(ADD_LINK).then(d => d.showDialog()));

    keyboardActionService.setGlobalActionHandler('SearchNotes', searchNotesService.toggleSearch);

    const $noteTabContainer = $("#note-tab-container");

    const showAttributesDialog = () => import(ATTRIBUTES).then(d => d.showDialog());
    $noteTabContainer.on("click", ".show-attributes-button", showAttributesDialog);
    keyboardActionService.setGlobalActionHandler("ShowAttributes", showAttributesDialog);

    const showNoteInfoDialog = () => import(NOTE_INFO).then(d => d.showDialog());
    $noteTabContainer.on("click", ".show-note-info-button", showNoteInfoDialog);
    keyboardActionService.setGlobalActionHandler("ShowNoteInfo", showNoteInfoDialog);

    const showNoteRevisionsDialog = function() {
        if ($(this).hasClass("disabled")) {
            return;
        }

        import(NOTE_REVISIONS).then(d => d.showCurrentNoteRevisions());
    };

    $noteTabContainer.on("click", ".show-note-revisions-button", showNoteRevisionsDialog);
    keyboardActionService.setGlobalActionHandler("ShowNoteRevisions", showNoteRevisionsDialog);

    const showNoteSourceDialog = function() {
        if ($(this).hasClass("disabled")) {
            return;
        }

        import(NOTE_SOURCE).then(d => d.showDialog());
    };

    $noteTabContainer.on("click", ".show-source-button", showNoteSourceDialog);
    keyboardActionService.setGlobalActionHandler("ShowNoteSource", showNoteSourceDialog);

    const showLinkMapDialog = () => import(LINK_MAP).then(d => d.showDialog());
    $noteTabContainer.on("click", ".show-link-map-button", showLinkMapDialog);
    keyboardActionService.setGlobalActionHandler("ShowLinkMap", showLinkMapDialog);

    keyboardActionService.setGlobalActionHandler("InsertDateTimeToText", () => {
        const date = new Date();
        const dateString = utils.formatDateTime(date);

        linkService.addTextToEditor(dateString);
    });

    keyboardActionService.setGlobalActionHandler("PasteMarkdownIntoText", async () => {
        const dialog = await import("../dialogs/markdown_import.js");

        dialog.importMarkdownInline();
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

    keyboardActionService.setGlobalActionHandler("CloneNotesTo", () => import(CLONE_TO).then(d => {
        const selectedOrActiveNodes = appContext.getMainNoteTree().getSelectedOrActiveNodes();

        const noteIds = selectedOrActiveNodes.map(node => node.data.noteId);

        d.showDialog(noteIds);
    }));

    keyboardActionService.setGlobalActionHandler("MoveNotesTo", () => import(MOVE_TO).then(d => {
        const selectedOrActiveNodes = appContext.getMainNoteTree().getSelectedOrActiveNodes();

        d.showDialog(selectedOrActiveNodes);
    }));
    
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

    keyboardActionService.setGlobalActionHandler("EditBranchPrefix", async () => {
        const node = appContext.getMainNoteTree().getActiveNode();

        const editBranchPrefixDialog = await import("../dialogs/branch_prefix.js");
        editBranchPrefixDialog.showDialog(node);
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
}

export default {
    registerEntrypoints
}