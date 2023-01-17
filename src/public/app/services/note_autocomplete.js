import server from "./server.js";
import appContext from "../components/app_context.js";
import utils from './utils.js';
import noteCreateService from './note_create.js';
import treeService from './tree.js';
import froca from "./froca.js";

// this key needs to have this value, so it's hit by the tooltip
const SELECTED_NOTE_PATH_KEY = "data-note-path";

const SELECTED_EXTERNAL_LINK_KEY = "data-external-link";

async function autocompleteSourceForCKEditor(queryText) {
    return await new Promise((res, rej) => {
        autocompleteSource(queryText, rows => {
            res(rows.map(row => {
                return {
                    action: row.action,
                    noteTitle: row.noteTitle,
                    id: `@${row.notePathTitle}`,
                    name: row.notePathTitle,
                    link: `#${row.notePath}`,
                    notePath: row.notePath,
                    highlightedNotePathTitle: row.highlightedNotePathTitle
                }
            }));
        }, {
            allowCreatingNotes: true
        });
    });
}

async function autocompleteSource(term, cb, options = {}) {
    const activeNoteId = appContext.tabManager.getActiveContextNoteId();

    let results = await server.get(`autocomplete?query=${encodeURIComponent(term)}&activeNoteId=${activeNoteId}`);

    if (term.trim().length >= 1 && options.allowCreatingNotes) {
        results = [
            {
                action: 'create-note',
                noteTitle: term,
                parentNoteId: activeNoteId || 'root',
                highlightedNotePathTitle: `Create and link child note "${utils.escapeHtml(term)}"`
            }
        ].concat(results);
    }

    if (term.match(/^[a-z]+:\/\/.+/i) && options.allowExternalLinks) {
        results = [
            {
                action: 'external-link',
                externalLink: term,
                highlightedNotePathTitle: `Insert external link to "${utils.escapeHtml(term)}"`
            }
        ].concat(results);
    }

    cb(results);
}

function clearText($el) {
    if (utils.isMobile()) {
        return;
    }

    $el.setSelectedNotePath("");
    $el.autocomplete("val", "").trigger('change');
}

function setText($el, text) {
    if (utils.isMobile()) {
        return;
    }

    $el.setSelectedNotePath("");
    $el
        .autocomplete("val", text.trim())
        .autocomplete("open");
}

function showRecentNotes($el) {
    if (utils.isMobile()) {
        return;
    }

    $el.setSelectedNotePath("");
    $el.autocomplete("val", "");
    $el.trigger('focus');

    // simulate pressing down arrow to trigger autocomplete
    const e = $.Event('keydown');
    e.which = 40; // arrow down
    $el.trigger(e);
}

function initNoteAutocomplete($el, options) {
    if ($el.hasClass("note-autocomplete-input") || utils.isMobile()) {
        // clear any event listener added in previous invocation of this function
        $el.off('autocomplete:noteselected');

        return $el;
    }

    options = options || {};

    $el.addClass("note-autocomplete-input");

    const $clearTextButton = $("<a>")
            .addClass("input-group-text input-clearer-button bx bx-x")
            .prop("title", "Clear text field");

    const $showRecentNotesButton = $("<a>")
            .addClass("input-group-text show-recent-notes-button bx bx-time")
            .prop("title", "Show recent notes");

    const $goToSelectedNoteButton = $("<a>")
        .addClass("input-group-text go-to-selected-note-button bx bx-arrow-to-right")
        .attr("data-action", "note");

    const $sideButtons = $("<div>")
        .addClass("input-group-append")
        .append($clearTextButton)
        .append($showRecentNotesButton);

    if (!options.hideGoToSelectedNoteButton) {
        $sideButtons.append($goToSelectedNoteButton);
    }

    $el.after($sideButtons);

    $clearTextButton.on('click', () => clearText($el));

    $showRecentNotesButton.on('click', e => {
        showRecentNotes($el);

        // this will cause the click not give focus to the "show recent notes" button
        // this is important because otherwise input will lose focus immediatelly and not show the results
        return false;
    });

    $el.autocomplete({
        appendTo: document.querySelector('body'),
        hint: false,
        autoselect: true,
        // openOnFocus has to be false, otherwise re-focus (after return from note type chooser dialog) forces
        // re-querying of the autocomplete source which then changes currently selected suggestion
        openOnFocus: false,
        minLength: 0,
        tabAutocomplete: false
    }, [
        {
            source: (term, cb) => autocompleteSource(term, cb, options),
            displayKey: 'notePathTitle',
            templates: {
                suggestion: suggestion => suggestion.highlightedNotePathTitle
            },
            // we can't cache identical searches because notes can be created / renamed, new recent notes can be added
            cache: false
        }
    ]);

    $el.on('autocomplete:selected', async (event, suggestion) => {
        if (suggestion.action === 'external-link') {
            $el.setSelectedNotePath(null);
            $el.setSelectedExternalLink(suggestion.externalLink);

            $el.autocomplete("val", suggestion.externalLink);

            $el.autocomplete("close");

            $el.trigger('autocomplete:externallinkselected', [suggestion]);

            return;
        }

        if (suggestion.action === 'create-note') {
            const {success, noteType, templateNoteId} = await noteCreateService.chooseNoteType();

            if (!success) {
                return;
            }

            const {note} = await noteCreateService.createNote(suggestion.parentNoteId, {
                title: suggestion.noteTitle,
                activate: false,
                type: noteType,
                templateNoteId: templateNoteId
            });

            suggestion.notePath = treeService.getSomeNotePath(note);
        }

        $el.setSelectedNotePath(suggestion.notePath);
        $el.setSelectedExternalLink(null);

        $el.autocomplete("val", suggestion.noteTitle);

        $el.autocomplete("close");

        $el.trigger('autocomplete:noteselected', [suggestion]);
    });

    $el.on('autocomplete:closed', () => {
        if (!$el.val().trim()) {
            clearText($el);
        }
    });

    $el.on('autocomplete:opened', () => {
        if ($el.attr("readonly")) {
            $el.autocomplete('close');
        }
    });

    // clear any event listener added in previous invocation of this function
    $el.off('autocomplete:noteselected');

    return $el;
}

function init() {
    $.fn.getSelectedNotePath = function () {
        if (!$(this).val().trim()) {
            return "";
        } else {
            return $(this).attr(SELECTED_NOTE_PATH_KEY);
        }
    };

    $.fn.getSelectedNoteId = function () {
        const notePath = $(this).getSelectedNotePath();
        if (!notePath) {
            return null;
        }

        const chunks = notePath.split('/');

        return chunks.length >= 1 ? chunks[chunks.length - 1] : null;
    }

    $.fn.setSelectedNotePath = function (notePath) {
        notePath = notePath || "";

        $(this).attr(SELECTED_NOTE_PATH_KEY, notePath);

        $(this)
            .closest(".input-group")
            .find(".go-to-selected-note-button")
            .toggleClass("disabled", !notePath.trim())
            .attr(SELECTED_NOTE_PATH_KEY, notePath); // we also set attr here so tooltip can be displayed
    };

    $.fn.getSelectedExternalLink = function () {
        if (!$(this).val().trim()) {
            return "";
        } else {
            return $(this).attr(SELECTED_EXTERNAL_LINK_KEY);
        }
    };

    $.fn.setSelectedExternalLink = function (externalLink) {
        $(this).attr(SELECTED_EXTERNAL_LINK_KEY, externalLink);

        $(this)
            .closest(".input-group")
            .find(".go-to-selected-note-button")
            .toggleClass("disabled", true);
    }

    $.fn.setNote = async function (noteId) {
        const note = noteId ? await froca.getNote(noteId, true) : null;

        $(this)
            .val(note ? note.title : "")
            .setSelectedNotePath(noteId);
    }
}

export default {
    autocompleteSourceForCKEditor,
    initNoteAutocomplete,
    showRecentNotes,
    setText,
    init
}
