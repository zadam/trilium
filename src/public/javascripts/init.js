"use strict";

import treeService from './note_tree.js';
import link from './link.js';
import messaging from './messaging.js';
import noteEditor from './note_editor.js';
import treeUtils from './tree_utils.js';
import utils from './utils.js';
import server from './server.js';

// hot keys are active also inside inputs and content editables
jQuery.hotkeys.options.filterInputAcceptingElements = false;
jQuery.hotkeys.options.filterContentEditable = false;
jQuery.hotkeys.options.filterTextInputs = false;

$(document).bind('keydown', 'alt+m', e => {
    $(".hide-toggle").toggleClass("suppressed");

    e.preventDefault();
});

// hide (toggle) everything except for the note content for distraction free writing
$(document).bind('keydown', 'alt+t', e => {
    const date = new Date();
    const dateString = utils.formatDateTime(date);

    link.addTextToEditor(dateString);

    e.preventDefault();
});

$(document).bind('keydown', 'f5', () => {
    utils.reloadApp();

    return false;
});

$(document).bind('keydown', 'ctrl+r', () => {
    utils.reloadApp();

    return false;
});

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

$(document).bind('keydown', "ctrl+shift+up", () => {
    const node = treeService.getCurrentNode();
    node.navigate($.ui.keyCode.UP, true);

    $("#note-detail").focus();

    return false;
});

$(document).bind('keydown', "ctrl+shift+down", () => {
    const node = treeService.getCurrentNode();
    node.navigate($.ui.keyCode.DOWN, true);

    $("#note-detail").focus();

    return false;
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
    noteEditor.saveNoteIfChanged();
});

// Overrides the default autocomplete filter function to search for matched on atleast 1 word in each of the input term's words
$.ui.autocomplete.filter = (array, terms) => {
    if (!terms) {
        return array;
    }

    const startDate = new Date();

    const results = [];
    const tokens = terms.toLowerCase().split(" ");

    for (const item of array) {
        const lcLabel = item.label.toLowerCase();

        const found = tokens.every(token => lcLabel.indexOf(token) !== -1);
        if (!found) {
            continue;
        }

        // this is not completely correct and might cause minor problems with note with names containing this " / "
        const lastSegmentIndex = lcLabel.lastIndexOf(" / ");

        if (lastSegmentIndex !== -1) {
            const lastSegment = lcLabel.substr(lastSegmentIndex + 3);

            // at least some token needs to be in the last segment (leaf note), otherwise this
            // particular note is not that interesting (query is satisfied by parent note)
            const foundInLastSegment = tokens.some(token => lastSegment.indexOf(token) !== -1);

            if (!foundInLastSegment) {
                continue;
            }
        }

        results.push(item);

        if (results.length > 100) {
            break;
        }
    }

    console.log("Search took " + (new Date().getTime() - startDate.getTime()) + "ms");

    return results;
};

$(document).tooltip({
    items: "#note-detail a",
    content: function(callback) {
        const notePath = link.getNotePathFromLink($(this).attr("href"));

        if (notePath !== null) {
            const noteId = treeUtils.getNoteIdFromNotePath(notePath);

            noteEditor.loadNote(noteId).then(note => callback(note.detail.content));
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

    messaging.logError(message);

    return false;
};

$("#logout-button").toggle(!utils.isElectron());

$(document).ready(() => {
    server.get("script/startup").then(scriptBundles => {
        for (const bundle of scriptBundles) {
            utils.executeBundle(bundle);
        }
    });
});

if (utils.isElectron()) {
    require('electron').ipcRenderer.on('create-day-sub-note', async function(event, parentNoteId) {
        // this might occur when day note had to be created
        if (!await treeService.noteExists(parentNoteId)) {
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
        url: baseApiUrl + 'attachments/upload/' + noteEditor.getCurrentNoteId(),
        headers: server.getHeaders(),
        data: formData,
        type: 'POST',
        contentType: false, // NEEDED, DON'T OMIT THIS
        processData: false, // NEEDED, DON'T OMIT THIS
    });

    await treeService.reload();

    await treeService.activateNode(resp.noteId);
});
