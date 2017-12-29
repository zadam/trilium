"use strict";

// hot keys are active also inside inputs and content editables
jQuery.hotkeys.options.filterInputAcceptingElements = false;
jQuery.hotkeys.options.filterContentEditable = false;
jQuery.hotkeys.options.filterTextInputs = false;

$(document).bind('keydown', 'alt+m', e => {
    const toggle = $(".hide-toggle");
    const hidden = toggle.css('visibility') === 'hidden';

    toggle.css('visibility', hidden ? 'visible' : 'hidden');

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

$(document).bind('keydown', "ctrl+shift+left", () => {
    const node = noteTree.getCurrentNode();
    node.navigate($.ui.keyCode.LEFT, true);

    $("#note-detail").focus();

    return false;
});

$(document).bind('keydown', "ctrl+shift+right", () => {
    const node = noteTree.getCurrentNode();
    node.navigate($.ui.keyCode.RIGHT, true);

    $("#note-detail").focus();

    return false;
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

$(window).on('beforeunload', () => {
    // this makes sure that when user e.g. reloads the page or navigates away from the page, the note's content is saved
    // this sends the request asynchronously and doesn't wait for result
    noteEditor.saveNoteIfChanged();
});

// Overrides the default autocomplete filter function to search for matched on atleast 1 word in each of the input term's words
$.ui.autocomplete.filter = (array, terms) => {
    if (!terms) {
        return [];
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

            noteEditor.loadNote(noteId).then(note => callback(note.detail.note_text));
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

let appShown = false;

function showAppIfHidden() {
    if (!appShown) {
        appShown = true;

        $("#container").show();

        // Get a reference to the loader's div
        const loaderDiv = document.getElementById("loader-wrapper");
        // When the transition ends remove loader's div from display
        // so that we can access the map with gestures or clicks
        loaderDiv.addEventListener("transitionend", function(){
            loaderDiv.style.display = "none";
        }, true);

        // Kick off the CSS transition
        loaderDiv.style.opacity = 0.0;
    }
}

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