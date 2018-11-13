import server from "./server.js";

/**
 * @param $el - element on which to init autocomplete
 * @param attributeType - "relation" or "label" or callback providing one of those values as a type of autocompleted attributes
 * @param open - should the autocomplete be opened after init?
 */
function initAttributeNameAutocomplete({ $el, attributeType, open }) {
    if (!$el.hasClass("aa-input")) {
        $el.autocomplete({
            appendTo: document.querySelector('body'),
            hint: false,
            autoselect: true,
            openOnFocus: true,
            minLength: 0
        }, [{
            displayKey: 'name',
            source: async (term, cb) => {
                const type = typeof attributeType === "function" ? attributeType() : attributeType;

                const names = await server.get(`attributes/names/?type=${type}&query=${encodeURIComponent(term)}`);
                const result = names.map(name => {
                    return {name};
                });

                if (result.length === 0) {
                    result.push({name: "No results"})
                }

                cb(result);
            }
        }]);
    }

    if (open) {
        $el.autocomplete("open");
    }
}

async function initLabelValueAutocomplete({ $el, open }) {
    if (!$el.hasClass("aa-input")) {
        const attributeName = $el.parent().parent().find('.attribute-name').val();

        if (attributeName.trim() === "") {
            return;
        }

        const attributeValues = (await server.get('attributes/values/' + encodeURIComponent(attributeName)))
            .map(attribute => { return { value: attribute }; });

        if (attributeValues.length === 0) {
            return;
        }

        $el.autocomplete({
            appendTo: document.querySelector('body'),
            hint: false,
            autoselect: true,
            openOnFocus: true,
            minLength: 0
        }, [{
            displayKey: 'value',
            source: function (term, cb) {
                term = term.toLowerCase();

                const filtered = attributeValues.filter(attr => attr.value.toLowerCase().includes(term));

                cb(filtered);
            }
        }]);
    }

    if (open) {
        $el.autocomplete("open");
    }
}

export default {
    initAttributeNameAutocomplete,
    initLabelValueAutocomplete
}