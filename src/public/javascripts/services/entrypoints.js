import utils from "./utils.js";
import treeService from "./tree.js";
import linkService from "./link.js";
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
import helpDialog from "../dialogs/help.js";
import noteInfoDialog from "../dialogs/note_info.js";
import aboutDialog from "../dialogs/about.js";
import linkMapDialog from "../dialogs/link_map.js";
import protectedSessionService from "./protected_session.js";

function registerEntrypoints() {
    // hot keys are active also inside inputs and content editables
    jQuery.hotkeys.options.filterInputAcceptingElements = false;
    jQuery.hotkeys.options.filterContentEditable = false;
    jQuery.hotkeys.options.filterTextInputs = false;

    utils.bindShortcut('ctrl+l', addLinkDialog.showDialog);
    utils.bindShortcut('ctrl+shift+l', addLinkDialog.showDialogForClone);

    $("#jump-to-note-dialog-button").click(jumpToNoteDialog.showDialog);
    utils.bindShortcut('ctrl+j', jumpToNoteDialog.showDialog);

    $("#recent-changes-button").click(recentChangesDialog.showDialog);

    $("#enter-protected-session-button").click(protectedSessionService.enterProtectedSession);
    $("#leave-protected-session-button").click(protectedSessionService.leaveProtectedSession);

    $("#toggle-search-button").click(searchNotesService.toggleSearch);
    utils.bindShortcut('ctrl+s', searchNotesService.toggleSearch);

    const $noteTabContainer = $("#note-tab-container");
    $noteTabContainer.on("click", ".show-attributes-button", attributesDialog.showDialog);
    utils.bindShortcut('alt+a', attributesDialog.showDialog);

    $noteTabContainer.on("click", ".show-note-info-button", noteInfoDialog.showDialog);

    $noteTabContainer.on("click", ".show-note-revisions-button", function() {
        if ($(this).hasClass("disabled")) {
            return;
        }

        noteRevisionsDialog.showCurrentNoteRevisions();
    });

    $noteTabContainer.on("click", ".show-source-button", function() {
        if ($(this).hasClass("disabled")) {
            return;
        }

        noteSourceDialog.showDialog();
    });

    $noteTabContainer.on("click", ".show-link-map-button", function() {
        linkMapDialog.showDialog();
    });

    $("#options-button").click(optionsDialog.showDialog);

    $("#show-help-button").click(helpDialog.showDialog);
    utils.bindShortcut('f1', helpDialog.showDialog);

    $("#open-sql-console-button").click(sqlConsoleDialog.showDialog);
    utils.bindShortcut('alt+o', sqlConsoleDialog.showDialog);

    $("#show-about-dialog-button").click(aboutDialog.showDialog);

    if (utils.isElectron()) {
        $("#history-navigation").show();
        $("#history-back-button").click(window.history.back);
        $("#history-forward-button").click(window.history.forward);

        if (utils.isMac()) {
            // Mac has a different history navigation shortcuts - https://github.com/zadam/trilium/issues/376
            utils.bindShortcut('meta+left', window.history.back);
            utils.bindShortcut('meta+right', window.history.forward);
        }
        else {
            utils.bindShortcut('alt+left', window.history.back);
            utils.bindShortcut('alt+right', window.history.forward);
        }
    }

    utils.bindShortcut('alt+m', e => {
        $(".hide-toggle").toggle();
        $("#container").toggleClass("distraction-free-mode");
    });

    // hide (toggle) everything except for the note content for distraction free writing
    utils.bindShortcut('alt+t', e => {
        const date = new Date();
        const dateString = utils.formatDateTime(date);

        linkService.addTextToEditor(dateString);
    });

    utils.bindShortcut('f5', utils.reloadApp);

    $("#reload-frontend-button").click(utils.reloadApp);
    utils.bindShortcut('ctrl+r', utils.reloadApp);

    $("#open-dev-tools-button").toggle(utils.isElectron());

    if (utils.isElectron()) {
        const openDevTools = () => {
            require('electron').remote.getCurrentWindow().toggleDevTools();

            return false;
        };

        utils.bindShortcut('ctrl+shift+i', openDevTools);
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
        utils.bindShortcut('ctrl+f', () => {
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

        utils.bindShortcut('f11', toggleFullscreen);
    }
    else {
        // outside of electron this is handled by the browser
        $("#toggle-fullscreen-button").hide();
    }

    if (utils.isElectron()) {
        utils.bindShortcut('ctrl+-', zoomService.decreaseZoomFactor);
        utils.bindShortcut('ctrl+=', zoomService.increaseZoomFactor);
    }
}

export default {
    registerEntrypoints
}