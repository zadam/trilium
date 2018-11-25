import utils from "./utils.js";
import treeService from "./tree.js";
import linkService from "./link.js";
import fileService from "./file.js";
import zoomService from "./zoom.js";
import noteRevisionsDialog from "../dialogs/note_revisions.js";
import optionsDialog from "../dialogs/options.js";
import addLinkDialog from "../dialogs/add_link.js";
import jumpToNoteDialog from "../dialogs/jump_to_note.js";
import noteSourceDialog from "../dialogs/note_source.js";
import recentChangesDialog from "../dialogs/recent_changes.js";
import sqlConsoleDialog from "../dialogs/sql_console.js";
import searchNotesService from "./search_notes.js";
import attributesDialog from "../dialogs/attributes.js";
import protectedSessionService from "./protected_session.js";

function registerEntrypoints() {
    // hot keys are active also inside inputs and content editables
    jQuery.hotkeys.options.filterInputAcceptingElements = false;
    jQuery.hotkeys.options.filterContentEditable = false;
    jQuery.hotkeys.options.filterTextInputs = false;

    utils.bindShortcut('ctrl+l', addLinkDialog.showDialog);

    $("#jump-to-note-dialog-button").click(jumpToNoteDialog.showDialog);
    utils.bindShortcut('ctrl+j', jumpToNoteDialog.showDialog);

    $("#show-note-revisions-button").click(function() {
        if ($(this).hasClass("disabled")) {
            return;
        }

        noteRevisionsDialog.showCurrentNoteRevisions();
    });

    $("#show-source-button").click(function() {
        if ($(this).hasClass("disabled")) {
            return;
        }

        noteSourceDialog.showDialog();
    });

    $("#recent-changes-button").click(recentChangesDialog.showDialog);

    $("#enter-protected-session-button").click(protectedSessionService.enterProtectedSession);
    $("#leave-protected-session-button").click(protectedSessionService.leaveProtectedSession);

    $("#toggle-search-button").click(searchNotesService.toggleSearch);
    utils.bindShortcut('ctrl+s', searchNotesService.toggleSearch);

    $(".show-attributes-button").click(attributesDialog.showDialog);
    utils.bindShortcut('alt+a', attributesDialog.showDialog);

    $("#options-button").click(optionsDialog.showDialog);

    utils.bindShortcut('alt+o', sqlConsoleDialog.showDialog);

    if (utils.isElectron()) {
        $("#history-navigation").show();
        $("#history-back-button").click(window.history.back);
        $("#history-forward-button").click(window.history.forward);

        utils.bindShortcut('alt+left', window.history.back);
        utils.bindShortcut('alt+right', window.history.forward);
    }

    utils.bindShortcut('alt+m', e => {
        $(".hide-toggle").toggle();

        const $container = $("#container");
        // when hiding switch display to block, otherwise grid still tries to display columns which shows
        // left empty column
        $container.css("display", $container.css("display") === "grid" ? "block" : "grid");
        $container.toggleClass("distraction-free-mode");
    });

    // hide (toggle) everything except for the note content for distraction free writing
    utils.bindShortcut('alt+t', e => {
        const date = new Date();
        const dateString = utils.formatDateTime(date);

        linkService.addTextToEditor(dateString);
    });

    utils.bindShortcut('f5', utils.reloadApp);

    utils.bindShortcut('ctrl+r', utils.reloadApp);

    $(document).bind('keydown', 'ctrl+shift+i', () => {
        if (utils.isElectron()) {
            require('electron').remote.getCurrentWindow().toggleDevTools();

            return false;
        }
    });

    $(document).bind('keydown', 'ctrl+f', () => {
        if (utils.isElectron()) {
            const $searchWindowWebview = $(".electron-in-page-search-window");
            $searchWindowWebview.show();

            const searchInPage = require('electron-in-page-search').default;
            const {remote} = require('electron');

            const inPageSearch = searchInPage(remote.getCurrentWebContents(), {
                searchWindowWebview: $searchWindowWebview[0],
                //openDevToolsOfSearchWindow: true,
                customCssPath: '/libraries/electron-in-page-search/default-style.css'
            });

            inPageSearch.openSearchWindow();

            return false;
        }
    });

    // FIXME: do we really need these at this point?
    utils.bindShortcut("ctrl+shift+up", () => {
        const node = treeService.getCurrentNode();
        node.navigate($.ui.keyCode.UP, true);

        $("#note-detail-text").focus();
    });


    // FIXME: do we really need these at this point?
    utils.bindShortcut("ctrl+shift+down", () => {
        const node = treeService.getCurrentNode();
        node.navigate($.ui.keyCode.DOWN, true);

        $("#note-detail-text").focus();
    });

    if (utils.isElectron()) {
        $(document).bind('keydown', 'ctrl+-', zoomService.decreaseZoomFactor);
        $(document).bind('keydown', 'ctrl+=', zoomService.increaseZoomFactor);
    }

    $("#note-title").bind('keydown', 'return', () => $("#note-detail-text").focus());

    $("#upload-file-button").click(fileService.uploadFile);
}

export default {
    registerEntrypoints
}