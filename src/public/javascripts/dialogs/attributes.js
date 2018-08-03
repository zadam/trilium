import noteDetailService from '../services/note_detail.js';
import server from '../services/server.js';
import infoService from "../services/info.js";

const $dialog = $("#attributes-dialog");
const $saveAttributesButton = $("#save-attributes-button");
const $attributesBody = $('#attributes-table tbody');

const attributesModel = new AttributesModel();

function AttributesModel() {
    const self = this;

    this.attributes = ko.observableArray();

    this.availableTypes = [
        { text: "Label", value: "label" },
        { text: "Label definition", value: "definition" },
        { text: "Relation", value: "relation" }
    ];

    this.typeChanged = function(data, event) {
        self.getTargetAttribute(event.target).valueHasMutated();
    };

    this.updateAttributePositions = function() {
        let position = 0;

        // we need to update positions by searching in the DOM, because order of the
        // attributes in the viewmodel (self.attributes()) stays the same
        $attributesBody.find('input[name="position"]').each(function() {
            const attribute = self.getTargetAttribute(this);

            attribute().position = position++;
        });
    };

    this.loadAttributes = async function() {
        const noteId = noteDetailService.getCurrentNoteId();

        const attributes = await server.get('notes/' + noteId + '/attributes');

        for (const attr of attributes) {
            attr.labelValue = attr.type === 'label' ? attr.value : '';
            attr.relationValue = attr.type === 'relation' ? attr.value : '';

            delete attr.value;
        }

        self.attributes(attributes.map(ko.observable));

        addLastEmptyRow();

        // attribute might not be rendered immediatelly so could not focus
        setTimeout(() => $(".attribute-name:last").focus(), 100);

        $attributesBody.sortable({
            handle: '.handle',
            containment: $attributesBody,
            update: this.updateAttributePositions
        });
    };

    this.deleteAttribute = function(data, event) {
        const attribute = self.getTargetAttribute(event.target);
        const attributeData = attribute();

        if (attributeData) {
            attributeData.isDeleted = 1;

            attribute(attributeData);

            addLastEmptyRow();
        }
    };

    function isValid() {
        for (let attributes = self.attributes(), i = 0; i < attributes.length; i++) {
            if (self.isEmptyName(i)) {
                return false;
            }
        }

        return true;
    }

    this.save = async function() {
        // we need to defocus from input (in case of enter-triggered save) because value is updated
        // on blur event (because of conflict with jQuery UI Autocomplete). Without this, input would
        // stay in focus, blur wouldn't be triggered and change wouldn't be updated in the viewmodel.
        $saveAttributesButton.focus();

        if (!isValid()) {
            alert("Please fix all validation errors and try saving again.");
            return;
        }

        self.updateAttributePositions();

        const noteId = noteDetailService.getCurrentNoteId();

        const attributesToSave = self.attributes()
            .map(attribute => attribute())
            .filter(attribute => attribute.attributeId !== "" || attribute.name !== "");

        const attributes = await server.put('notes/' + noteId + '/attributes', attributesToSave);

        self.attributes(attributes.map(ko.observable));

        addLastEmptyRow();

        infoService.showMessage("Attributes have been saved.");

        noteDetailService.loadAttributeList();
    };

    function addLastEmptyRow() {
        const attributes = self.attributes().filter(attr => attr().isDeleted === 0);
        const last = attributes.length === 0 ? null : attributes[attributes.length - 1]();

        if (!last || last.name.trim() !== "") {
            self.attributes.push(ko.observable({
                attributeId: '',
                type: 'label',
                name: '',
                labelValue: '',
                relationValue: '',
                isInheritable: false,
                isDeleted: 0,
                position: 0
            }));
        }
    }

    this.attributeChanged = function (data, event) {
        addLastEmptyRow();

        const attribute = self.getTargetAttribute(event.target);

        attribute.valueHasMutated();
    };

    this.isNotUnique = function(index) {
        const cur = self.attributes()[index]();

        if (cur.name.trim() === "") {
            return false;
        }

        for (let attributes = self.attributes(), i = 0; i < attributes.length; i++) {
            const attribute = attributes[i]();

            if (index !== i && cur.name === attribute.name) {
                return true;
            }
        }

        return false;
    };

    this.isEmptyName = function(index) {
        const cur = self.attributes()[index]();

        return cur.name.trim() === "" && (cur.attributeId !== "" || cur.labelValue !== "" || cur.relationValue);
    };

    this.getTargetAttribute = function(target) {
        const context = ko.contextFor(target);
        const index = context.$index();

        return self.attributes()[index];
    }
}

async function showDialog() {
    glob.activeDialog = $dialog;

    await attributesModel.loadAttributes();

    $dialog.dialog({
        modal: true,
        width: 950,
        height: 500
    });
}

ko.applyBindings(attributesModel, $dialog[0]);

$dialog.on('focus', '.attribute-name', function (e) {
    if (!$(this).hasClass("ui-autocomplete-input")) {
        $(this).autocomplete({
            source: async (request, response) => {
                const attribute = attributesModel.getTargetAttribute(this);
                const type = attribute().type === 'relation' ? 'relation' : 'label';
                const names = await server.get('attributes/names/?type=' + type + '&query=' + encodeURIComponent(request.term));
                const result = names.map(name => {
                    return {
                        label: name,
                        value: name
                    }
                });

                if (result.length > 0) {
                    response(result);
                }
                else {
                    response([{
                        label: "No results",
                        value: "No results"
                    }]);
                }
            },
            minLength: 0
        });
    }

    $(this).autocomplete("search", $(this).val());
});

$dialog.on('focus', '.label-value', async function (e) {
    if (!$(this).hasClass("ui-autocomplete-input")) {
        const attributeName = $(this).parent().parent().find('.attribute-name').val();

        if (attributeName.trim() === "") {
            return;
        }

        const attributeValues = await server.get('attributes/values/' + encodeURIComponent(attributeName));

        if (attributeValues.length === 0) {
            return;
        }

        $(this).autocomplete({
            // shouldn't be required and autocomplete should just accept array of strings, but that fails
            // because we have overriden filter() function in autocomplete.js
            source: attributeValues.map(attribute => {
                return {
                    attribute: attribute,
                    value: attribute
                }
            }),
            minLength: 0
        });
    }

    $(this).autocomplete("search", $(this).val());
});

async function initNoteAutocomplete($el) {
    if (!$el.hasClass("ui-autocomplete-input")) {
        await $el.autocomplete({
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
            select: function (event, ui) {
                if (ui.item.value === 'No results') {
                    return false;
                }
            }
        });
    }
}

$dialog.on('focus', '.relation-target-note-id', async function () {
    await initNoteAutocomplete($(this));
});

$dialog.on('click', '.relations-show-recent-notes', async function () {
    const $autocomplete = $(this).parent().find('.relation-target-note-id');

    await initNoteAutocomplete($autocomplete);

    $autocomplete.autocomplete("search", "");
});

export default {
    showDialog
};