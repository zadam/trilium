import utils from "./utils.js";
import keys from "./keybindings.js";
import linkService from "./link.js";
import zoomService from "./zoom.js";
import protectedSessionService from "./protected_session.js";
import searchNotesService from "./search_notes.js";

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

function registerEntrypoints() {
    // hot keys are active also inside inputs and content editables
    jQuery.hotkeys.options.filterInputAcceptingElements = false;
    jQuery.hotkeys.options.filterContentEditable = false;
    jQuery.hotkeys.options.filterTextInputs = false;

    keys.bind(keys.actions.AddLink, () => import(ADD_LINK).then(d => d.showDialog()));
    keys.bind(keys.actions.Clone, () => import(ADD_LINK).then(d => d.showDialogForClone()));

    $("#jump-to-note-dialog-button").click(() => import(JUMP_TO_NOTE).then(d => d.showDialog()));
    keys.bind(keys.actions.JumpToNote, () => import(JUMP_TO_NOTE).then(d => d.showDialog()));

    $("#recent-changes-button").click(() => import(RECENT_CHANGES).then(d => d.showDialog()));

    $("#enter-protected-session-button").click(protectedSessionService.enterProtectedSession);
    $("#leave-protected-session-button").click(protectedSessionService.leaveProtectedSession);

    $("#toggle-search-button").click(searchNotesService.toggleSearch);
    keys.bind(keys.actions.Search, searchNotesService.toggleSearch);

    const $noteTabContainer = $("#note-tab-container");
    $noteTabContainer.on("click", ".show-attributes-button", () => import(ATTRIBUTES).then(d => d.showDialog()));
    keys.bind(keys.actions.ShowAttributes, () => import(ATTRIBUTES).then(d => d.showDialog()));

    $noteTabContainer.on("click", ".show-note-info-button", () => import(NOTE_INFO).then(d => d.showDialog()));

    $noteTabContainer.on("click", ".show-note-revisions-button", function() {
        if ($(this).hasClass("disabled")) {
            return;
        }

        import(NOTE_REVISIONS).then(d => d.showCurrentNoteRevisions());
    });

    $noteTabContainer.on("click", ".show-source-button", function() {
        if ($(this).hasClass("disabled")) {
            return;
        }

        import(NOTE_SOURCE).then(d => d.showDialog());
    });

    $noteTabContainer.on("click", ".show-link-map-button", function() {
        import(LINK_MAP).then(d => d.showDialog());
    });

    $("#options-button").click(() => import(OPTIONS).then(d => d.showDialog()));

    $("#show-help-button").click(() => import(HELP).then(d => d.showDialog()));
    keys.bind(keys.actions.ShowHelp, () => import(HELP).then(d => d.showDialog()));

    $("#open-sql-console-button").click(() => import(SQL_CONSOLE).then(d => d.showDialog()));
    keys.bind(keys.actions.OpenSQLConsole, () => import(SQL_CONSOLE).then(d => d.showDialog()));

    $("#show-about-dialog-button").click(() => import(ABOUT).then(d => d.showDialog()));

    if (utils.isElectron()) {
        $("#history-navigation").show();
        $("#history-back-button").click(window.history.back);
        $("#history-forward-button").click(window.history.forward);

        keys.bind(keys.actions.BackHistory, window.history.back);
        keys.bind(keys.actions.ForwardHistory, window.history.forward);
    }

    keys.bind(keys.actions.ZenMode, e => {
        $(".hide-toggle").toggle();
        $("#container").toggleClass("distraction-free-mode");
    });

    // hide (toggle) everything except for the note content for distraction free writing
    keys.bind(keys.actions.InsertDateTime, e => {
        const date = new Date();
        const dateString = utils.formatDateTime(date);

        linkService.addTextToEditor(dateString);
    });

    keys.bind(keys.actions.ReloadApp, utils.reloadApp);

    $("#reload-frontend-button").click(utils.reloadApp);

    $("#open-dev-tools-button").toggle(utils.isElectron());

    if (utils.isElectron()) {
        const openDevTools = () => {
            require('electron').remote.getCurrentWindow().toggleDevTools();

            return false;
        };

        keys.bind(keys.actions.OpenDevTools, openDevTools);
        $("#open-dev-tools-button").click(openDevTools);
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
    }

    if (utils.isElectron()) {
        keys.bind(keys.actions.Find, () => {
            findInPage.openFindWindow();

            return false;
        });
    }

    if (utils.isElectron()) {
        const toggleFullscreen = function() {
            const win = require('electron').remote.getCurrentWindow();

            if (win.isFullScreenable()) {
                win.setFullScreen(!win.isFullScreen());
            }

            return false;
        };

        $("#toggle-fullscreen-button").click(toggleFullscreen);

        keys.bind(keys.actions.ToggleFullscreen, toggleFullscreen);
    }
    else {
        // outside of electron this is handled by the browser
        $("#toggle-fullscreen-button").hide();
    }

    if (utils.isElectron()) {
        keys.bind(keys.actions.ZoomOut, zoomService.decreaseZoomFactor);
        keys.bind(keys.actions.ZoomInc, zoomService.increaseZoomFactor);
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

export default {
    registerEntrypoints
}
