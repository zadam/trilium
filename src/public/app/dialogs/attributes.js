import server from '../services/server.js';
import toastService from "../services/toast.js";
import treeService from "../services/tree.js";
import attributeAutocompleteService from "../services/attribute_autocomplete.js";
import utils from "../services/utils.js";
import linkService from "../services/link.js";
import libraryLoader from "../services/library_loader.js";
import noteAutocompleteService from "../services/note_autocomplete.js";
import appContext from "../services/app_context.js";

const $dialog = $("#attributes-dialog");
const $saveAttributesButton = $("#save-attributes-button");
const $ownedAttributesBody = $('#owned-attributes-table tbody');

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
        let position = 10;

        // we need to update positions by searching in the DOM, because order of the
        // attributes in the viewmodel (self.ownedAttributes()) stays the same
        $ownedAttributesBody.find('input[name="position"]').each(function() {
            const attribute = self.getTargetAttribute(this);

            attribute().position = position;
            position += 10;
        });
    };

    async function showAttributes(noteId, attributes) {
        const ownedAttributes = attributes.filter(attr => attr.noteId === noteId);

        for (const attr of ownedAttributes) {
            attr.labelValue = attr.type === 'label' ? attr.value : '';
            attr.relationValue = attr.type === 'relation' ? (await treeService.getNoteTitle(attr.value)) : '';
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

        const inheritedAttributes = attributes.filter(attr => attr.noteId !== noteId);

        self.inheritedAttributes(inheritedAttributes);
    }

    this.loadAttributes = async function() {
        const noteId = appContext.tabManager.getActiveTabNoteId();

        const attributes = await server.get('notes/' + noteId + '/attributes');

        await showAttributes(noteId, attributes);

        // attribute might not be rendered immediatelly so could not focus
        setTimeout(() => $(".attribute-type-select:last").trigger('focus'), 1000);
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
        $saveAttributesButton.trigger('focus');

        if (!isValid()) {
            alert("Please fix all validation errors and try saving again.");
            return;
        }

        self.updateAttributePositions();

        const noteId = appContext.tabManager.getActiveTabNoteId();

        const attributesToSave = self.ownedAttributes()
            .map(attribute => attribute())
            .filter(attribute => attribute.attributeId !== "" || attribute.name !== "");

        for (const attr of attributesToSave) {
            if (attr.type === 'label') {
                attr.value = attr.labelValue;
            }
            else if (attr.type === 'relation') {
                attr.value = treeService.getNoteIdFromNotePath(attr.selectedPath);
            }
            else if (attr.type === 'label-definition') {
                attr.value = JSON.stringify(attr.labelDefinition);
            }
            else if (attr.type === 'relation-definition') {
                attr.value = JSON.stringify(attr.relationDefinition);
            }

            delete attr.labelValue;
            delete attr.relationValue;
            delete attr.labelDefinition;
            delete attr.relationDefinition;
        }

        const attributes = await server.put('notes/' + noteId + '/attributes', attributesToSave);

        await showAttributes(noteId, attributes);

        toastService.showMessage("Attributes have been saved.");
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

let attributesModel;

function initKoPlugins() {
    ko.bindingHandlers.noteLink = {
        init: async function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            const noteId = ko.unwrap(valueAccessor());

            if (noteId) {
                const link = await linkService.createNoteLink(noteId);

                $(element).append(link);
            }
        }
    };

    ko.bindingHandlers.noteAutocomplete = {
        init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            noteAutocompleteService.initNoteAutocomplete($(element));

            $(element).setSelectedPath(bindingContext.$data.selectedPath);

            $(element).on('autocomplete:selected', function (event, suggestion, dataset) {
                bindingContext.$data.selectedPath = $(element).val().trim() ? suggestion.path : '';
            });
        }
    };
}

export async function showDialog() {
    await libraryLoader.requireLibrary(libraryLoader.KNOCKOUT);

    // lazily apply bindings on first use
    if (!attributesModel) {
        attributesModel = new AttributesModel();

        initKoPlugins();

        ko.applyBindings(attributesModel, $dialog[0]);
    }

    await attributesModel.loadAttributes();

    utils.openDialog($dialog);
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
