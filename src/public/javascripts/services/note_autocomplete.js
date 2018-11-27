import server from "./server.js";
import noteDetailService from "./note_detail.js";
import treeService from './tree.js';

// this key needs to have this value so it's hit by the tooltip
const SELECTED_PATH_KEY = "data-note-path";

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
    $el.setSelectedPath("");
    $el.autocomplete("val", "").change();
}

function showRecentNotes($el) {
    $el.setSelectedPath("");
    $el.autocomplete("val", "");
    $el.autocomplete("open");
}

function initNoteAutocomplete($el, options) {
    if (!$el.hasClass("note-autocomplete-input")) {
        options = options || {};

        $el.addClass("note-autocomplete-input");

        const $clearTextButton = $("<a>")
                .addClass("input-group-text input-clearer-button jam jam-close")
                .prop("title", "Clear text field");

        const $showRecentNotesButton = $("<a>")
                .addClass("input-group-text show-recent-notes-button jam jam-clock")
                .prop("title", "Show recent notes");

        const $goToSelectedNoteButton = $("<a>")
            .addClass("input-group-text go-to-selected-note-button jam jam-arrow-right");

        const $sideButtons = $("<div>")
            .addClass("input-group-append")
            .append($clearTextButton)
            .append($showRecentNotesButton);

        if (!options.hideGoToSelectedNoteButton) {
            $sideButtons.append($goToSelectedNoteButton);
        }

        $el.after($sideButtons);

        $clearTextButton.click(() => clearText($el));

        $showRecentNotesButton.click(() => showRecentNotes($el));

        $goToSelectedNoteButton.click(() => {
            if ($el.hasClass("disabled")) {
                return;
            }

            treeService.activateNote($el.getSelectedPath());
        });

        $el.autocomplete({
            appendTo: document.querySelector('body'),
            hint: false,
            autoselect: true,
            openOnFocus: true,
            minLength: 0,
            tabAutocomplete: false
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
                clearText($el);
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
        return $(this).attr(SELECTED_PATH_KEY);
    }
};

$.fn.setSelectedPath = function(path) {
    path = path || "";

    $(this).attr(SELECTED_PATH_KEY, path);

    $(this)
        .closest(".input-group")
        .find(".go-to-selected-note-button")
        .toggleClass("disabled", !path.trim())
        .attr(SELECTED_PATH_KEY, path); // we also set attr here so tooltip can be displayed
};

ko.bindingHandlers.noteAutocomplete = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        initNoteAutocomplete($(element));

        $(element).setSelectedPath(bindingContext.$data.selectedPath);

        $(element).on('autocomplete:selected', function(event, suggestion, dataset) {
            bindingContext.$data.selectedPath = $(element).val().trim() ? suggestion.path : '';
        });
    }
};

export default {
    initNoteAutocomplete,
    showRecentNotes
}