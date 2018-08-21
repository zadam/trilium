import noteDetailService from '../services/note_detail.js';
import server from '../services/server.js';
import infoService from "../services/info.js";
import treeUtils from "../services/tree_utils.js";
import linkService from "../services/link.js";

const $dialog = $("#attributes-dialog");
const $saveAttributesButton = $("#save-attributes-button");
const $ownedAttributesBody = $('#owned-attributes-table tbody');

const attributesModel = new AttributesModel();

function AttributesModel() {
    const self = this;

    this.ownedAttributes = ko.observableArray();
    this.inheritedAttributes = ko.observableArray();

    this.availableTypes = [
        { text: "Label", value: "label" },
        { text: "Label definition", value: "label-definition" },
        { text: "Relation", value: "relation" },
        { text: "Relation definition", value: "relation-definition" }
    ];

    this.availableLabelTypes = [
        { text: "Text", value: "text" },
        { text: "Number", value: "number" },
        { text: "Boolean", value: "boolean" },
        { text: "Date", value: "date" },
        { text: "URL", value: "url"}
    ];

    this.multiplicityTypes = [
        { text: "Single value", value: "singlevalue" },
        { text: "Multi value", value: "multivalue" }
    ];

    this.typeChanged = function(data, event) {
        self.getTargetAttribute(event.target).valueHasMutated();
    };

    this.labelTypeChanged = function(data, event) {
        self.getTargetAttribute(event.target).valueHasMutated();
    };

    this.updateAttributePositions = function() {
        let position = 0;

        // we need to update positions by searching in the DOM, because order of the
        // attributes in the viewmodel (self.ownedAttributes()) stays the same
        $ownedAttributesBody.find('input[name="position"]').each(function() {
            const attribute = self.getTargetAttribute(this);

            attribute().position = position++;
        });
    };

    async function showAttributes(attributes) {
        const ownedAttributes = attributes.filter(attr => attr.isOwned);

        for (const attr of ownedAttributes) {
            attr.labelValue = attr.type === 'label' ? attr.value : '';
            attr.relationValue = attr.type === 'relation' ? (await treeUtils.getNoteTitle(attr.value) + " (" + attr.value + ")") : '';
            attr.labelDefinition = (attr.type === 'label-definition' && attr.value) ? attr.value : {
                labelType: "text",
                multiplicityType: "singlevalue",
                isPromoted: true
            };

            attr.relationDefinition = (attr.type === 'relation-definition' && attr.value) ? attr.value : {
                multiplicityType: "singlevalue",
                isPromoted: true
            };

            delete attr.value;
        }

        self.ownedAttributes(ownedAttributes.map(ko.observable));

        addLastEmptyRow();

        const inheritedAttributes = attributes.filter(attr => !attr.isOwned);

        self.inheritedAttributes(inheritedAttributes);
    }

    this.loadAttributes = async function() {
        const noteId = noteDetailService.getCurrentNoteId();

        const attributes = await server.get('notes/' + noteId + '/attributes');

        await showAttributes(attributes);

        // attribute might not be rendered immediatelly so could not focus
        setTimeout(() => $(".attribute-type-select:last").focus(), 100);

        $ownedAttributesBody.sortable({
            handle: '.handle',
            containment: $ownedAttributesBody,
            update: this.updateAttributePositions
        });
    };

    this.deleteAttribute = function(data, event) {
        const attribute = self.getTargetAttribute(event.target);
        const attributeData = attribute();

        if (attributeData) {
            attributeData.isDeleted = true;

            attribute(attributeData);

            addLastEmptyRow();
        }
    };

    function isValid() {
        for (let attributes = self.ownedAttributes(), i = 0; i < attributes.length; i++) {
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

        const attributesToSave = self.ownedAttributes()
            .map(attribute => attribute())
            .filter(attribute => attribute.attributeId !== "" || attribute.name !== "");

        for (const attr of attributesToSave) {
            if (attr.type === 'label') {
                attr.value = attr.labelValue;
            }
            else if (attr.type === 'relation') {
                attr.value = treeUtils.getNoteIdFromNotePath(linkService.getNotePathFromLabel(attr.relationValue));
            }
            else if (attr.type === 'label-definition') {
                attr.value = attr.labelDefinition;
            }
            else if (attr.type === 'relation-definition') {
                attr.value = attr.relationDefinition;
            }

            delete attr.labelValue;
            delete attr.relationValue;
            delete attr.labelDefinition;
            delete attr.relationDefinition;
        }

        const attributes = await server.put('notes/' + noteId + '/attributes', attributesToSave);

        await showAttributes(attributes);

        infoService.showMessage("Attributes have been saved.");

        noteDetailService.loadAttributes();
    };

    function addLastEmptyRow() {
        const attributes = self.ownedAttributes().filter(attr => !attr().isDeleted);
        const last = attributes.length === 0 ? null : attributes[attributes.length - 1]();

        if (!last || last.name.trim() !== "") {
            self.ownedAttributes.push(ko.observable({
                attributeId: '',
                type: 'label',
                name: '',
                labelValue: '',
                relationValue: '',
                isInheritable: false,
                isDeleted: false,
                position: 0,
                labelDefinition: {
                    labelType: "text",
                    multiplicityType: "singlevalue",
                    isPromoted: true
                },
                relationDefinition: {
                    multiplicityType: "singlevalue",
                    isPromoted: true
                }
            }));
        }
    }

    this.attributeChanged = function (data, event) {
        addLastEmptyRow();

        const attribute = self.getTargetAttribute(event.target);

        attribute.valueHasMutated();
    };

    this.isEmptyName = function(index) {
        const cur = self.ownedAttributes()[index]();

        return cur.name.trim() === "" && !cur.isDeleted && (cur.attributeId !== "" || cur.labelValue !== "" || cur.relationValue);
    };

    this.getTargetAttribute = function(target) {
        const context = ko.contextFor(target);
        const index = context.$index();

        return self.ownedAttributes()[index];
    }
}

async function showDialog() {
    glob.activeDialog = $dialog;

    await attributesModel.loadAttributes();

    $dialog.dialog({
        modal: true,
        width: 950,
        height: 700
    });
}

ko.applyBindings(attributesModel, $dialog[0]);

$dialog.on('focus', '.attribute-name', function (e) {
    if (!$(this).hasClass("ui-autocomplete-input")) {
        $(this).autocomplete({
            source: async (request, response) => {
                const attribute = attributesModel.getTargetAttribute(this);
                const type = (attribute().type === 'relation' || attribute().type === 'relation-definition') ? 'relation' : 'label';
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

export default {
    showDialog
};