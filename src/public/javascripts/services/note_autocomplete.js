import server from "./server.js";
import noteDetailService from "./note_detail.js";
import utils from './utils.js';

// this key needs to have this value so it's hit by the tooltip
const SELECTED_PATH_KEY = "data-note-path";

async function autocompleteSource(term, cb) {
    const result = await server.get('autocomplete'
        + '?query=' + encodeURIComponent(term)
        + '&activeNoteId=' + noteDetailService.getActiveNoteId());

    if (result.length === 0) {
        result.push({
            title: "No results",
            path: ""
        });
    }

    cb(result);
}

function clearText($el) {
    if (utils.isMobile()) {
        return;
    }

    $el.setSelectedPath("");
    $el.autocomplete("val", "").change();
}

function showRecentNotes($el) {
    if (utils.isMobile()) {
        return;
    }

    $el.setSelectedPath("");
    $el.autocomplete("val", "");
    $el.focus();
}

function initNoteAutocomplete($el, options) {
    if ($el.hasClass("note-autocomplete-input") || utils.isMobile()) {
        return $el;
    }

    options = options || {};

    $el.addClass("note-autocomplete-input");

    const $clearTextButton = $("<a>")
            .addClass("input-group-text input-clearer-button jam jam-close")
            .prop("title", "Clear text field");

    const $showRecentNotesButton = $("<a>")
            .addClass("input-group-text show-recent-notes-button jam jam-clock")
            .prop("title", "Show recent notes");

    const $goToSelectedNoteButton = $("<a>")
        .addClass("input-group-text go-to-selected-note-button jam jam-arrow-right")
        .attr("data-action", "note");

    const $sideButtons = $("<div>")
        .addClass("input-group-append")
        .append($clearTextButton)
        .append($showRecentNotesButton);

    if (!options.hideGoToSelectedNoteButton) {
        $sideButtons.append($goToSelectedNoteButton);
    }

    $el.after($sideButtons);

    $clearTextButton.click(() => clearText($el));

    $showRecentNotesButton.click(e => {
        showRecentNotes($el);

        // this will cause the click not give focus to the "show recent notes" button
        // this is important because otherwise input will lose focus immediatelly and not show the results
        return false;
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
            },
            // we can't cache identical searches because notes can be created / renamed, new recent notes can be added
            cache: false
        }
    ]);

    $el.on('autocomplete:selected', (event, suggestion) => $el.setSelectedPath(suggestion.path));
    $el.on('autocomplete:closed', () => {
        if (!$el.val().trim()) {
            clearText($el);
        }
    });

    return $el;
}

function init() {
    $.fn.getSelectedPath = function () {
        if (!$(this).val().trim()) {
            return "";
        } else {
            return $(this).attr(SELECTED_PATH_KEY);
        }
    };

    $.fn.setSelectedPath = function (path) {
        path = path || "";

        $(this).attr(SELECTED_PATH_KEY, path);

        $(this)
            .closest(".input-group")
            .find(".go-to-selected-note-button")
            .toggleClass("disabled", !path.trim())
            .attr(SELECTED_PATH_KEY, path); // we also set attr here so tooltip can be displayed
    };

    ko.bindingHandlers.noteAutocomplete = {
        init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            initNoteAutocomplete($(element));

            $(element).setSelectedPath(bindingContext.$data.selectedPath);

            $(element).on('autocomplete:selected', function (event, suggestion, dataset) {
                bindingContext.$data.selectedPath = $(element).val().trim() ? suggestion.path : '';
            });
        }
    };
}

export default {
    initNoteAutocomplete,
    showRecentNotes,
    init
}