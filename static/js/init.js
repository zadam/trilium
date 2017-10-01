// hot keys are active also inside inputs and content editables
jQuery.hotkeys.options.filterInputAcceptingElements = true;
jQuery.hotkeys.options.filterContentEditable = true;

$(document).bind('keydown', 'alt+m', function() {
    const toggle = $(".hide-toggle");
    const hidden = toggle.css('display') === 'none';

    toggle.css('display', hidden ? 'block' : 'none');

    $("#noteDetailWrapper").css("width", hidden ? "750px" : "100%");
});

$(document).bind('keydown', 'alt+s', function() {
    $("input[name=search]").focus();
});

function getDateFromTS(timestamp) {
    // Date accepts number of milliseconds since epoch so UTC timestamp works without any extra handling
    // see https://stackoverflow.com/questions/4631928/convert-utc-epoch-to-local-date-with-javascript
    const utcDate = new Date(timestamp * 1000);

    const localDate = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60 * 1000);

    return localDate;
}

function formatTime(date) {
    return (date.getHours() <= 9 ? "0" : "") + date.getHours() + ":" + (date.getMinutes() <= 9 ? "0" : "") + date.getMinutes();
}

function formatDate(date) {
    return date.getDate() + ". " + (date.getMonth() + 1) + ". " + date.getFullYear();
}

function formatDateTime(date) {
    return formatDate(date) + " " + formatTime(date);
}

// hide (toggle) everything except for the note content for distraction free writing
$(document).bind('keydown', 'alt+t', function() {
    const date = new Date();
    const dateString = formatDateTime(date);

    $('#noteDetail').summernote('insertText', dateString);
});

$(window).on('beforeunload', function(){
    // this makes sure that when user e.g. reloads the page or navigates away from the page, the note's content is saved
    // this sends the request asynchronously and doesn't wait for result
    saveNoteIfChanged();
});

// Overrides the default autocomplete filter function to search for matched on atleast 1 word in each of the input term's words
$.ui.autocomplete.filter = function (array, terms) {
    const options = {
        shouldSort: true,
        threshold: 0.6,
        location: 0,
        distance: 100,
        maxPatternLength: 32,
        minMatchCharLength: 1,
        keys: [
            "value"
        ]
    };


    const startDate = new Date();

    const fuse = new Fuse(array, options); // "list" is the item array

    const results = fuse.search(terms);

    console.log("Search took " + (new Date().getTime() - startDate.getTime()) + "ms");

    return results;
};

$.ui.autocomplete.filter = function (array, terms) {
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