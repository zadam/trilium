import server from "./server.js";
import noteDetailService from "./note_detail.js";

async function autocompleteSource(term, cb) {
    const result = await server.get('autocomplete'
        + '?query=' + encodeURIComponent(term)
        + '&currentNoteId=' + noteDetailService.getCurrentNoteId());

    if (result.length > 0) {
        cb(result.map(row => {
            return {
                label: row.label,
                value: row.label + ' (' + row.value + ')'
            }
        }));
    }
    else {
        cb([{
            label: "No results",
            value: "No results"
        }]);
    }
}

async function initNoteAutocomplete($el) {
    if (!$el.hasClass("ui-autocomplete-input")) {
        const $showRecentNotesButton = $("<div>").addClass("input-group-append").append(
            $("<span>")
                .addClass("input-group-text show-recent-notes-button")
                .prop("title", "Show recent notes"));

        $el.after($showRecentNotesButton);

        $showRecentNotesButton.click(() => $el.autocomplete("search", ""));

        await $el.autocomplete({
            appendTo: $el.parent().parent(),
            source: autocompleteSource,
            minLength: 0,
            change: function (event, ui) {
                $el.trigger("change");
            },
            select: function (event, ui) {
                if (ui.item.value === 'No results') {
                    return false;
                }
            }
        });
    }
}

ko.bindingHandlers.noteAutocomplete = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        initNoteAutocomplete($(element));
    }
};

export default {
    initNoteAutocomplete,
    autocompleteSource
}