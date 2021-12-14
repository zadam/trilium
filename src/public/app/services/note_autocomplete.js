import server from "./server.js";
import appContext from "./app_context.js";
import utils from './utils.js';
import noteCreateService from './note_create.js';
import treeService from './tree.js';
import froca from "./froca.js";

// this key needs to have this value so it's hit by the tooltip
const SELECTED_NOTE_PATH_KEY = "data-note-path";

const acMixin = {
    selectedNotePath: "",
    selectedExternalLink: "",
    $el: "",

    focus() {
        this.$el.find('.aa-Input').focus();
    },

    select() {
        this.$el.find('.aa-Input').select();
    },

    getQuery() {
        return this?.lastState.query;
    },

    getSelectedNotePath() {
        if (!this.getQuery()) {
            return "";
        } else {
            return this.selectedNotePath;
        }
    },

    getSelectedNoteId() {
        const notePath = this.getSelectedNotePath();
        const chunks = notePath.split('/');

        return chunks.length >= 1 ? chunks[chunks.length - 1] : null;
    },

    setSelectedNotePath(notePath) {
        notePath = notePath || "";

        this.selectedNotePath = notePath;

        $(this)
            .closest(".input-group")
            .find(".go-to-selected-note-button")
            .toggleClass("disabled", !notePath.trim())
            .attr(SELECTED_NOTE_PATH_KEY, notePath); // we also set attr here so tooltip can be displayed
    },

    getSelectedExternalLink() {
        if (!$(this).val().trim()) {
            return "";
        } else {
            return this.selectedExternalLink;
        }
    },

    setSelectedExternalLink(externalLink) {
        this.selectedExternalLink = externalLink;

        $(this)
            .closest(".input-group")
            .find(".go-to-selected-note-button")
            .toggleClass("disabled", true);
    },

    async setNote(noteId) {
        const note = noteId ? await froca.getNote(noteId, true) : null;

        $(this)
            .val(note ? note.title : "")
            .setSelectedNotePath(noteId);
    }
}

async function autocompleteSourceForCKEditor(queryText) {
    return await new Promise((res, rej) => {
        autocompleteSource(queryText, rows => {
            res(rows.map(row => {
                return {
                    action: row.action,
                    noteTitle: row.noteTitle,
                    id: '@' + row.notePathTitle,
                    name: row.notePathTitle,
                    link: '#' + row.notePath,
                    notePath: row.notePath,
                    highlightedNotePathTitle: row.highlightedNotePathTitle
                }
            }));
        }, {
            allowCreatingNotes: true
        });
    });
}

async function autocompleteSource(term, options = {}) {
    const activeNoteId = appContext.tabManager.getActiveContextNoteId();

    let results = await server.get('autocomplete'
            + '?query=' + encodeURIComponent(term)
            + '&activeNoteId=' + activeNoteId);

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

    return results;
}

function clearText(acObj) {
    if (utils.isMobile()) {
        return;
    }

    acObj.ext.setSelectedNotePath("");
    acObj.setQuery("");
}

function setText(ac, text) {
    if (utils.isMobile()) {
        return;
    }

    ac.ext.setSelectedNotePath("");
    ac.setQuery(text.trim());
    ac.setIsOpen(true);
}

function showRecentNotes(ac) {
    if (utils.isMobile()) {
        return;
    }

    ac.ext.$el.find(".aa-Input").val("").change();

    ac.setQuery("");
    ac.setIsOpen(true);
    ac.update();
    ac.ext.setSelectedNotePath("");
    ac.ext.focus();


    console.log("BBB");
}

function initNoteAutocomplete($container, options) {
    if ($container.hasClass("note-autocomplete-container") || utils.isMobile()) {
        // clear any event listener added in previous invocation of this function
        $container.off('autocomplete:noteselected');

        return $container.prop("acObj");
    }

    options = options || {};

    const $el = $('<div class="note-autocomplete-input">');
    const $sideButtons = $('<div>');

    $container.addClass("note-autocomplete-container")
        .append($el)
        .append($sideButtons);

    const $showRecentNotesButton = $("<a>")
            .addClass("show-recent-notes-button bx bx-time")
            .prop("title", "Show recent notes");

    const $goToSelectedNoteButton = $("<a>")
        .addClass("go-to-selected-note-button bx bx-arrow-to-right")
        .attr("data-action", "note");

    $sideButtons.append($showRecentNotesButton);

    if (!options.hideGoToSelectedNoteButton) {
        $sideButtons.append($goToSelectedNoteButton);
    }

    $showRecentNotesButton.on('click', e => {
        showRecentNotes(acObj);

        // this will cause the click not give focus to the "show recent notes" button
        // this is important because otherwise input will lose focus immediatelly and not show the results
        return false;
    });

    const { autocomplete } = window['@algolia/autocomplete-js'];

    let acObj = autocomplete({
        container: $el[0],
        defaultActiveItemId: 0,
        openOnFocus: true,
        tabAutocomplete: false,
        placeholder: options.placeholder,
        onStateChange({ state }) {
            acObj.lastState = state;
        },
        async getSources({ query }) {
            const items = await autocompleteSource(query, options);

            return [
                {
                    getItems() {
                        return items;
                    },
                    onSelect({item}) {
                        acObj.ext.$el.trigger("autocomplete:selected", [item]);
                    },
                    displayKey: 'notePathTitle',
                    templates: {
                        item({ item, createElement }) {
                            return createElement('div', {
                                dangerouslySetInnerHTML: {
                                    __html: item.highlightedNotePathTitle,
                                },
                            });
                        }
                    },
                    // we can't cache identical searches because notes can be created / renamed, new recent notes can be added
                    cache: false
                }
            ]
        }
    });

    acObj.ext = {...acMixin, $el, $container };

    $container.prop("acObj", acObj);

    $container.on('autocomplete:selected', async (event, item) => {
        if (item.action === 'external-link') {
            acObj.ext.setSelectedNotePath(null);
            acObj.ext.setSelectedExternalLink(item.externalLink);

            acObj.setQuery(item.externalLink);

            $container.autocomplete("close");

            $container.trigger('autocomplete:externallinkselected', [item]);

            return;
        }

        if (item.action === 'create-note') {
            const {note} = await noteCreateService.createNote(item.parentNoteId, {
                title: item.noteTitle,
                activate: false
            });

            item.notePath = treeService.getSomeNotePath(note);
        }

        acObj.ext.setSelectedNotePath(item.notePath);
        acObj.ext.setSelectedExternalLink(null);

        acObj.setQuery(item.noteTitle);

        acObj.setIsOpen(false);

        $container.trigger('autocomplete:noteselected', [item]);
    });

    $container.on('autocomplete:closed', () => {
        if (!$container.val().trim()) {
            clearText($container);
        }
    });

    $container.on('autocomplete:opened', () => {
        if ($container.attr("readonly")) {
            $container.autocomplete('close');
        }
    });

    // clear any event listener added in previous invocation of this function
    $container.off('autocomplete:noteselected');

    return acObj;
}

export default {
    autocompleteSource,
    autocompleteSourceForCKEditor,
    initNoteAutocomplete,
    showRecentNotes,
    setText
}
