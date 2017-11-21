"use strict";

const glob = {
    activeDialog: null
};

// hot keys are active also inside inputs and content editables
jQuery.hotkeys.options.filterInputAcceptingElements = true;
jQuery.hotkeys.options.filterContentEditable = true;

$(document).bind('keydown', 'alt+m', () => {
    const toggle = $(".hide-toggle");
    const hidden = toggle.css('visibility') === 'hidden';

    toggle.css('visibility', hidden ? 'visible' : 'hidden');
});

// hide (toggle) everything except for the note content for distraction free writing
$(document).bind('keydown', 'alt+t', () => {
    const date = new Date();
    const dateString = formatDateTime(date);

    $('#note-detail').summernote('insertText', dateString);
});

$(document).bind('keydown', 'f5', () => {
    window.location.reload(true);

    return false;
});

$(document).bind('keydown', 'ctrl+r', () => {
    window.location.reload(true);

    return false;
});

$(document).bind('keydown', 'ctrl+shift+i', () => {
    if (isElectron()) {
        require('electron').remote.getCurrentWindow().toggleDevTools();

        return false;
    }
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
    items: ".note-editable a",
    content: function(callback) {
        const noteId = link.getNotePathFromLink($(this).attr("href"));

        if (noteId !== null) {
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

function isElectron() {
    return window && window.process && window.process.type;
}

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

function initAjax() {
    $.ajaxSetup({
        headers: {
            'x-browser-id': browserId,
            'x-protected-session-id': typeof protected_session !== 'undefined' ? protected_session.getProtectedSessionId() : null
        }
    });
}

initAjax();