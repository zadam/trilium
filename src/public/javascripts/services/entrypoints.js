import utils from "./utils.js";
import treeService from "./tree.js";
import linkService from "./link.js";
import fileService from "./file.js";
import zoomService from "./zoom.js";
import noteRevisionsDialog from "../dialogs/note_revisions.js";
import optionsDialog from "../dialogs/options.js";
import addLinkDialog from "../dialogs/add_link.js";
import recentNotesDialog from "../dialogs/recent_notes.js";
import jumpToNoteDialog from "../dialogs/jump_to_note.js";
import noteSourceDialog from "../dialogs/note_source.js";
import recentChangesDialog from "../dialogs/recent_changes.js";
import sqlConsoleDialog from "../dialogs/sql_console.js";
import searchNotesService from "./search_notes.js";
import labelsDialog from "../dialogs/labels.js";
import protectedSessionService from "./protected_session.js";

function registerEntrypoints() {
    // hot keys are active also inside inputs and content editables
    jQuery.hotkeys.options.filterInputAcceptingElements = false;
    jQuery.hotkeys.options.filterContentEditable = false;
    jQuery.hotkeys.options.filterTextInputs = false;

    utils.bindShortcut('ctrl+l', addLinkDialog.showDialog);

    $("#jump-to-note-dialog-button").click(jumpToNoteDialog.showDialog);
    utils.bindShortcut('ctrl+j', jumpToNoteDialog.showDialog);

    $("#show-note-revisions-button").click(noteRevisionsDialog.showCurrentNoteRevisions);

    $("#show-source-button").click(noteSourceDialog.showDialog);
    utils.bindShortcut('ctrl+u', noteSourceDialog.showDialog);

    $("#recent-changes-button").click(recentChangesDialog.showDialog);

    $("#protected-session-on").click(protectedSessionService.enterProtectedSession);
    $("#protected-session-off").click(protectedSessionService.leaveProtectedSession);

    $("#recent-notes-button").click(recentNotesDialog.showDialog);
    utils.bindShortcut('ctrl+e', recentNotesDialog.showDialog);

    $("#toggle-search-button").click(searchNotesService.toggleSearch);
    utils.bindShortcut('ctrl+s', searchNotesService.toggleSearch);

    $(".show-labels-button").click(labelsDialog.showDialog);
    utils.bindShortcut('alt+l', labelsDialog.showDialog);

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

        // when hiding switch display to block, otherwise grid still tries to display columns which shows
        // left empty column
        $("#container").css("display", $("#container").css("display") === "grid" ? "block" : "grid");
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
            const searchInPage = require('electron-in-page-search').default;
            const remote = require('electron').remote;

            const inPageSearch = searchInPage(remote.getCurrentWebContents());

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