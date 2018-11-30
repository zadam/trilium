import noteDetailService from '../services/note_detail.js';
import server from '../services/server.js';
import infoService from "../services/info.js";
import treeUtils from "../services/tree_utils.js";
import attributeService from "../services/attributes.js";
import attributeAutocompleteService from "../services/attribute_autocomplete.js";

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
            attr.relationValue = attr.type === 'relation' ? (await treeUtils.getNoteTitle(attr.value)) : '';
            attr.selectedPath = attr.type === 'relation' ? attr.value : '';
            attr.labelDefinition = (attr.type === 'label-definition' && attr.value) ? attr.value : {
                labelType: "text",
                multiplicityType: "singlevalue",
                isPromoted: true,
                numberPrecision: 0
            };

            attr.relationDefinition = (attr.type === 'relation-definition' && attr.value) ? attr.value : {
                multiplicityType: "singlevalue",
                inverseRelation: "",
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
            if (self.isEmptyName(i) || self.isEmptyRelationTarget(i)) {
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
                attr.value = treeUtils.getNoteIdFromNotePath(attr.selectedPath);
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

        attributeService.refreshAttributes();
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
                    isPromoted: true,
                    numberPrecision: 0
                },
                relationDefinition: {
                    multiplicityType: "singlevalue",
                    inverseRelation: "",
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

        if (cur.name.trim() || cur.isDeleted) {
            return false;
        }

        if (cur.attributeId) {
            // name is empty and attribute already exists so this is NO-GO
            return true;
        }

        if (cur.type === 'relation-definition' || cur.type === 'label-definition') {
            // for definitions there's no possible empty value so we always require name
            return true;
        }

        if (cur.type === 'label' && cur.labelValue) {
            return true;
        }

        if (cur.type === 'relation' && cur.relationValue) {
            return true;
        }

        return false;
    };

    this.isEmptyRelationTarget = function(index) {
        const cur = self.ownedAttributes()[index]();

        return cur.type === "relation" && !cur.isDeleted && cur.name && !cur.relationValue;
    };

    this.getTargetAttribute = function(target) {
        const context = ko.contextFor(target);
        const index = context.$index();

        return self.ownedAttributes()[index];
    }
}

async function showDialog() {
    // lazily apply bindings on first use
    if (!ko.dataFor($dialog[0])) {
        ko.applyBindings(attributesModel, $dialog[0]);
    }

    glob.activeDialog = $dialog;

    await attributesModel.loadAttributes();

    $dialog.modal();
}

$dialog.on('focus', '.attribute-name', function (e) {
    attributeAutocompleteService.initAttributeNameAutocomplete({
        $el: $(this),
        attributeType: () => {
            const attribute = attributesModel.getTargetAttribute(this);
            return (attribute().type === 'relation' || attribute().type === 'relation-definition') ? 'relation' : 'label';
        },
        open: true
    });
});

$dialog.on('focus', '.label-value', function (e) {
    attributeAutocompleteService.initLabelValueAutocomplete({
        $el: $(this),
        open: true
    })
});

export default {
    showDialog
};