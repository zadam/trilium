import server from "./server.js";
import noteDetailService from "./note_detail.js";

const SELECTED_PATH_KEY = "selected-path";

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

function clearText($el) {
    $el.autocomplete("val", "").change();
}

function showRecentNotes($el) {
    $el.autocomplete("val", "");
    $el.autocomplete("open");
}

function initNoteAutocomplete($el) {
    if (!$el.hasClass("aa-input")) {
        const $clearTextButton = $("<span>")
                .addClass("input-group-text input-clearer-button jam jam-close")
                .prop("title", "Clear text field");

        const $showRecentNotesButton = $("<span>")
                .addClass("input-group-text show-recent-notes-button jam jam-clock")
                .prop("title", "Show recent notes");

        $el.after($("<div>")
            .addClass("input-group-append")
            .append($clearTextButton)
            .append($showRecentNotesButton));

        $clearTextButton.click(() => clearText($el));

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

        $el.on('autocomplete:selected', (event, suggestion) => $el.setSelectedPath(suggestion.path));
        $el.on('autocomplete:closed', () => {
            if (!$el.val().trim()) {
                $el.setSelectedPath("");
            }
        });
    }

    return $el;
}

$.fn.getSelectedPath = function() {
    if (!$(this).val().trim()) {
        return "";
    }
    else {
        return $(this).data(SELECTED_PATH_KEY);
    }
};

$.fn.setSelectedPath = function(path) {
    $(this).data(SELECTED_PATH_KEY, path);
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