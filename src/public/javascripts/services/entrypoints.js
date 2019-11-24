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

const NOTE_REVISIONS = "../dialogs/note_revisions.js";
const OPTIONS = "../dialogs/options.js";
const ADD_LINK = "../dialogs/add_link.js";
const JUMP_TO_NOTE = "../dialogs/jump_to_note.js";
const NOTE_SOURCE = "../dialogs/note_source.js";
const RECENT_CHANGES = "../dialogs/recent_changes.js";
const SQL_CONSOLE = "../dialogs/sql_console.js";
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

    const showJumpToNoteDialog = () => import(JUMP_TO_NOTE).then(d => d.showDialog());
    $("#jump-to-note-dialog-button").on('click', showJumpToNoteDialog);
    keyboardActionService.setGlobalActionHandler("JumpToNote", showJumpToNoteDialog);

    const showRecentChanges = () => import(RECENT_CHANGES).then(d => d.showDialog());
    $("#recent-changes-button").on('click', showRecentChanges);
    keyboardActionService.setGlobalActionHandler("ShowRecentChanges", showRecentChanges);

    $("#enter-protected-session-button").on('click', protectedSessionService.enterProtectedSession);
    $("#leave-protected-session-button").on('click', protectedSessionService.leaveProtectedSession);

    $("#toggle-search-button").on('click', searchNotesService.toggleSearch);
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

    const showOptionsDialog = () => import(OPTIONS).then(d => d.showDialog());
    $("#options-button").on('click', showOptionsDialog);
    keyboardActionService.setGlobalActionHandler("ShowOptions", showOptionsDialog);

    const showHelpDialog = () => import(HELP).then(d => d.showDialog());
    $("#show-help-button").on('click', showHelpDialog);
    keyboardActionService.setGlobalActionHandler("ShowHelp", showHelpDialog);

    const showSqlConsoleDialog = () => import(SQL_CONSOLE).then(d => d.showDialog());
    $("#open-sql-console-button").on('click', showSqlConsoleDialog);
    keyboardActionService.setGlobalActionHandler("ShowSQLConsole", showSqlConsoleDialog);

    $("#show-about-dialog-button").on('click', () => import(ABOUT).then(d => d.showDialog()));

    if (utils.isElectron()) {
        $("#history-navigation").show();
        $("#history-back-button").on('click', window.history.back);
        keyboardActionService.setGlobalActionHandler("BackInNoteHistory", window.history.back);

        $("#history-forward-button").on('click', window.history.forward);
        keyboardActionService.setGlobalActionHandler("ForwardInNoteHistory", window.history.forward);
    }

    // hide (toggle) everything except for the note content for zen mode
    const toggleZenMode = () => {
        $(".hide-in-zen-mode").toggle();
        $("#container").toggleClass("zen-mode");
    };

    $("#toggle-zen-mode-button").on('click', toggleZenMode);
    keyboardActionService.setGlobalActionHandler("ToggleZenMode", toggleZenMode);

    keyboardActionService.setGlobalActionHandler("InsertDateTimeToText", () => {
        const date = new Date();
        const dateString = utils.formatDateTime(date);

        linkService.addTextToEditor(dateString);
    });

    $("#reload-frontend-button").on('click', utils.reloadApp);
    keyboardActionService.setGlobalActionHandler("ReloadFrontendApp", utils.reloadApp);

    $("#open-dev-tools-button").toggle(utils.isElectron());

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
        const toggleFullscreen = () => {
            const win = require('electron').remote.getCurrentWindow();

            if (win.isFullScreenable()) {
                win.setFullScreen(!win.isFullScreen());
            }

            return false;
        };

        $("#toggle-fullscreen-button").on('click', toggleFullscreen);

        keyboardActionService.setGlobalActionHandler("ToggleFullscreen", toggleFullscreen);
    }
    else {
        // outside of electron this is handled by the browser
        $("#toggle-fullscreen-button").hide();
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
        const activeNode = treeService.getActiveNode();

        const selectedOrActiveNodes = treeService.getSelectedOrActiveNodes(activeNode);

        const noteIds = selectedOrActiveNodes.map(node => node.data.noteId);

        d.showDialog(noteIds);
    }));

    keyboardActionService.setGlobalActionHandler("MoveNotesTo", () => import(MOVE_TO).then(d => {
        const activeNode = treeService.getActiveNode();

        const selectedOrActiveNodes = treeService.getSelectedOrActiveNodes(activeNode);

        d.showDialog(selectedOrActiveNodes);
    }));
    
    keyboardActionService.setGlobalActionHandler("CreateNoteIntoDayNote", async () => {
        const todayNote = await dateNoteService.getTodayNote();
        const notePath = await treeService.getSomeNotePath(todayNote);

        const node = await treeService.expandToNote(notePath);

        const {note} = await treeService.createNote(node, todayNote.noteId, 'into', {
            type: "text",
            isProtected: node.data.isProtected
        });

        await noteDetailService.openInTab(note.noteId, true);
    });

    keyboardActionService.setGlobalActionHandler("EditBranchPrefix", async () => {
        const node = treeService.getActiveNode();

        const editBranchPrefixDialog = await import("../dialogs/branch_prefix.js");
        editBranchPrefixDialog.showDialog(node);
    });

    keyboardActionService.setGlobalActionHandler("ToggleNoteHoisting", async () => {
        const node = treeService.getActiveNode();

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
        const node = treeService.getActiveNode();

        searchNotesService.searchInSubtree(node.data.noteId);
    });
}

export default {
    registerEntrypoints
}