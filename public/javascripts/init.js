glob = {
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

$(window).on('beforeunload', () => {
    // this makes sure that when user e.g. reloads the page or navigates away from the page, the note's content is saved
    // this sends the request asynchronously and doesn't wait for result
    saveNoteIfChanged();
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
        const lcValue = item.value.toLowerCase();

        for (const token of tokens) {
            if (lcValue.indexOf(token) === -1) {
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
        const noteId = getNoteIdFromLink($(this).attr("href"));

        if (noteId !== null) {
            loadNote(noteId).then(note => callback(note.detail.note_text));
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

// when click on link popup, in case of internal link, just go the the referenced note instead of default behavior
// of opening the link in new window/tab
$(document).on('click', "a[action='note']", goToInternalNote);
$(document).on('click', 'div.popover-content a, div.ui-tooltip-content', goToInternalNote);
$(document).on('dblclick', '.note-editable a, div.ui-tooltip-content', goToInternalNote);

function goToInternalNote(e) {
    const linkEl = $(e.target);
    let noteId = linkEl.attr("note-id");

    if (!noteId) {
        noteId = getNoteIdFromLink(linkEl.attr('href'));
    }

    if (noteId) {
        getNodeByKey(noteId).setActive();

        // this is quite ugly hack, but it seems like we can't close the tooltip otherwise
        $("[role='tooltip']").remove();

        if (glob.activeDialog) {
            try {
                glob.activeDialog.dialog('close');
            }
            catch (e) {}
        }

        e.preventDefault();
    }
}

function getNoteIdFromLink(url) {
    const noteIdMatch = /app#([A-Za-z0-9]{12})/.exec(url);

    if (noteIdMatch === null) {
        return null;
    }
    else {
        return noteIdMatch[1];
    }
}

function getNodeIdFromLabel(label) {
    const noteIdMatch = / \(([A-Za-z0-9]{12})\)/.exec(label);

    if (noteIdMatch !== null) {
        return noteIdMatch[1];
    }

    return null;
}

function createNoteLink(noteId) {
    const noteLink = $("<a>", {
        href: 'javascript:',
        text: getFullName(noteId)
    }).attr('action', 'note')
        .attr('note-id', noteId);

    return noteLink;
}