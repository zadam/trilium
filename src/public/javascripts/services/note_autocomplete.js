import server from "./server.js";

async function initNoteAutocomplete($el) {
    if (!$el.hasClass("ui-autocomplete-input")) {
        const $showRecentNotesButton = $("<span>")
            .addClass("input-group-addon show-recent-notes-button")
            .prop("title", "Show recent notes");

        $el.after($showRecentNotesButton);

        $showRecentNotesButton.click(() => $el.autocomplete("search", ""));

        await $el.autocomplete({
            appendTo: $el.parent().parent(),
            source: async function (request, response) {
                const result = await server.get('autocomplete?query=' + encodeURIComponent(request.term));

                if (result.length > 0) {
                    response(result.map(row => {
                        return {
                            label: row.label,
                            value: row.label + ' (' + row.value + ')'
                        }
                    }));
                }
                else {
                    response([{
                        label: "No results",
                        value: "No results"
                    }]);
                }
            },
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
    initNoteAutocomplete
}