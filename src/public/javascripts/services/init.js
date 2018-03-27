import treeService from './tree.js';
import linkService from './link.js';
import messagingService from './messaging.js';
import noteDetailService from './note_detail.js';
import treeUtils from './tree_utils.js';
import utils from './utils.js';
import server from './server.js';
import bundleService from './bundle.js';
import treeCache from "./tree_cache.js";

// hot keys are active also inside inputs and content editables
jQuery.hotkeys.options.filterInputAcceptingElements = false;
jQuery.hotkeys.options.filterContentEditable = false;
jQuery.hotkeys.options.filterTextInputs = false;

utils.bindShortcut('alt+m', e => $(".hide-toggle").toggleClass("suppressed"));

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

utils.bindShortcut("ctrl+shift+up", () => {
    const node = treeService.getCurrentNode();
    node.navigate($.ui.keyCode.UP, true);

    $("#note-detail").focus();
});

utils.bindShortcut("ctrl+shift+down", () => {
    const node = treeService.getCurrentNode();
    node.navigate($.ui.keyCode.DOWN, true);

    $("#note-detail").focus();
});

$(document).bind('keydown', 'ctrl+-', () => {
    if (utils.isElectron()) {
        const webFrame = require('electron').webFrame;

        if (webFrame.getZoomFactor() > 0.2) {
            webFrame.setZoomFactor(webFrame.getZoomFactor() - 0.1);
        }

        return false;
    }
});

$(document).bind('keydown', 'ctrl+=', () => {
    if (utils.isElectron()) {
        const webFrame = require('electron').webFrame;

        webFrame.setZoomFactor(webFrame.getZoomFactor() + 0.1);

        return false;
    }
});

$("#note-title").bind('keydown', 'return', () => $("#note-detail").focus());

$(window).on('beforeunload', () => {
    // this makes sure that when user e.g. reloads the page or navigates away from the page, the note's content is saved
    // this sends the request asynchronously and doesn't wait for result
    noteDetailService.saveNoteIfChanged();
});

$(document).tooltip({
    items: "#note-detail a",
    content: function(callback) {
        const notePath = linkService.getNotePathFromLink($(this).attr("href"));

        if (notePath !== null) {
            const noteId = treeUtils.getNoteIdFromNotePath(notePath);

            noteDetailService.loadNote(noteId).then(note => callback(note.content));
        }
    },
    close: function(event, ui)
    {
        ui.tooltip.hover(function()
            {
                $(this).stop(true).fadeTo(400, 1);
            },
            function()
            {
                $(this).fadeOut('400', function()
                {
                    $(this).remove();
                });
            });
    }
});

window.onerror = function (msg, url, lineNo, columnNo, error) {
    const string = msg.toLowerCase();

    let message = "Uncaught error: ";

    if (string.indexOf("script error") > -1){
        message += 'No details available';
    }
    else {
        message += [
            'Message: ' + msg,
            'URL: ' + url,
            'Line: ' + lineNo,
            'Column: ' + columnNo,
            'Error object: ' + JSON.stringify(error)
        ].join(' - ');
    }

    messagingService.logError(message);

    return false;
};

$("#logout-button").toggle(!utils.isElectron());

$(document).ready(() => {
    server.get("script/startup").then(scriptBundles => {
        for (const bundle of scriptBundles) {
            bundleService.executeBundle(bundle);
        }
    });
});

if (utils.isElectron()) {
    require('electron').ipcRenderer.on('create-day-sub-note', async function(event, parentNoteId) {
        // this might occur when day note had to be created
        if (!await treeCache.getNote(parentNoteId)) {
            await treeService.reload();
        }

        await treeService.activateNode(parentNoteId);

        setTimeout(() => {
            const node = treeService.getCurrentNode();

            treeService.createNote(node, node.data.noteId, 'into', node.data.isProtected);
        }, 500);
    });
}

function uploadAttachment() {
    $("#attachment-upload").trigger('click');
}

$("#upload-attachment-button").click(uploadAttachment);

$("#attachment-upload").change(async function() {
    const formData = new FormData();
    formData.append('upload', this.files[0]);

    const resp = await $.ajax({
        url: baseApiUrl + 'attachments/upload/' + noteDetailService.getCurrentNoteId(),
        headers: server.getHeaders(),
        data: formData,
        type: 'POST',
        contentType: false, // NEEDED, DON'T OMIT THIS
        processData: false, // NEEDED, DON'T OMIT THIS
    });

    await treeService.reload();

    await treeService.activateNode(resp.noteId);
});
