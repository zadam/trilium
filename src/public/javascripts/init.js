"use strict";

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
    const dateString = formatDateTime(date);

    link.addTextToEditor(dateString);

    e.preventDefault();
});

$(document).bind('keydown', 'f5', () => {
    reloadApp();

    return false;
});

$(document).bind('keydown', 'ctrl+r', () => {
    reloadApp();

    return false;
});

$(document).bind('keydown', 'ctrl+shift+i', () => {
    if (isElectron()) {
        require('electron').remote.getCurrentWindow().toggleDevTools();

        return false;
    }
});

$(document).bind('keydown', 'ctrl+f', () => {
    if (isElectron()) {
        const searchInPage = require('electron-in-page-search').default;
        const remote = require('electron').remote;

        const inPageSearch = searchInPage(remote.getCurrentWebContents());

        inPageSearch.openSearchWindow();

        return false;
    }
});

$(document).bind('keydown', "ctrl+shift+up", () => {
    const node = noteTree.getCurrentNode();
    node.navigate($.ui.keyCode.UP, true);

    $("#note-detail").focus();

    return false;
});

$(document).bind('keydown', "ctrl+shift+down", () => {
    const node = noteTree.getCurrentNode();
    node.navigate($.ui.keyCode.DOWN, true);

    $("#note-detail").focus();

    return false;
});

$(document).bind('keydown', 'ctrl+-', () => {
    if (isElectron()) {
        const webFrame = require('electron').webFrame;

        if (webFrame.getZoomFactor() > 0.2) {
            webFrame.setZoomFactor(webFrame.getZoomFactor() - 0.1);
        }

        return false;
    }
});

$(document).bind('keydown', 'ctrl+=', () => {
    if (isElectron()) {
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
        let found = true;
        const lcLabel = item.label.toLowerCase();

        for (const token of tokens) {
            if (lcLabel.indexOf(token) === -1) {
                found = false;
                break;
            }
        }

        if (found) {
            results.push(item);

            if (results.length > 100) {
                break;
            }
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

$("#logout-button").toggle(!isElectron());

$(document).ready(() => {
    server.get("script/startup").then(scripts => {
        for (const script of scripts) {
            executeScript(script);
        }
    });
});

if (isElectron()) {
    require('electron').ipcRenderer.on('create-sub-note', async function(event, message) {
        const {parentNoteId, content} = JSON.parse(message);

        if (!noteTree.noteExists(parentNoteId)) {
            await noteTree.reload();
        }

        await noteTree.activateNode(parentNoteId);

        const node = noteTree.getCurrentNode();

        await noteTree.createNote(node, node.data.noteId, 'into', node.data.isProtected);

        setTimeout(() => noteEditor.setContent(content), 1000);
    });
}