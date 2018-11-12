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
                .addClass("input-group-text show-recent-notes-button jam jam-clock")
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
                        return suggestion.highlighted;
                    }
                }
            }
        ]);

        $el.on('autocomplete:selected', function(event, suggestion, dataset) {
            $el.prop("data-selected-path", suggestion.path);
        });

        $el.on('autocomplete:closed', () => {
            $el.prop("data-selected-path", "");
        });
    }

    return $el;
}

$.fn.getSelectedPath = function() {
    if (!$(this).val().trim()) {
        return "";
    }
    else {
        return $(this).prop("data-selected-path");
    }
};

ko.bindingHandlers.noteAutocomplete = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        initNoteAutocomplete($(element));

        $(element).on('autocomplete:selected', function(event, suggestion, dataset) {
            bindingContext.$data.selectedPath = $(element).val().trim() ? suggestion.path : '';
        });
    }
};

export default {
    initNoteAutocomplete,
    showRecentNotes
}