import server from "./server.js";
import noteDetailService from "./note_detail.js";

async function autocompleteSource(term, cb) {
    const result = await server.get('autocomplete'
        + '?query=' + encodeURIComponent(term)
        + '&currentNoteId=' + noteDetailService.getCurrentNoteId());

    if (result.length === 0) {
        result.push({
            title: "No results",
            path: ""
        });
    }

    cb(result);
}

function showRecentNotes($el) {
    $el.autocomplete("val", "");
    $el.autocomplete("open");
}

function initNoteAutocomplete($el) {
    if (!$el.hasClass("aa-input")) {
        const $showRecentNotesButton = $("<div>").addClass("input-group-append").append(
            $("<span>")
                .addClass("input-group-text show-recent-notes-button")
                .prop("title", "Show recent notes"));

        $el.after($showRecentNotesButton);

        $showRecentNotesButton.click(() => showRecentNotes($el));

        $el.autocomplete({
            appendTo: document.querySelector('body'),
            hint: false,
            autoselect: true,
            openOnFocus: true,
            minLength: 0
        }, [
            {
                source: autocompleteSource,
                displayKey: 'title',
                templates: {
                    suggestion: function(suggestion) {
                        return suggestion.title;
                    }
                }
            }
        ]);
    }

    return $el;
}

ko.bindingHandlers.noteAutocomplete = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        initNoteAutocomplete($(element));
    }
};

export default {
    initNoteAutocomplete,
    autocompleteSource,
    showRecentNotes
}