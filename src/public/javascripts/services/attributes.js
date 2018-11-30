import server from "./server.js";
import utils from "./utils.js";
import messagingService from "./messaging.js";
import treeUtils from "./tree_utils.js";
import noteAutocompleteService from "./note_autocomplete.js";
import linkService from "./link.js";
import noteDetailService from "./note_detail.js";

const $attributeList = $("#attribute-list");
const $attributeListInner = $("#attribute-list-inner");
const $promotedAttributesContainer = $("#note-detail-promoted-attributes");
const $savedIndicator = $("#saved-indicator");

let attributePromise;

async function refreshAttributes() {
    attributePromise = server.get('notes/' + noteDetailService.getCurrentNoteId() + '/attributes');

    await showAttributes();
}

async function getAttributes() {
    return await attributePromise;
}

async function showAttributes() {
    $promotedAttributesContainer.empty();
    $attributeList.hide();
    $attributeListInner.empty();

    const note = noteDetailService.getCurrentNote();

    const attributes = await attributePromise;

    const promoted = attributes.filter(attr =>
        (attr.type === 'label-definition' || attr.type === 'relation-definition')
        && !attr.name.startsWith("child:")
        && attr.value.isPromoted);

    const hidePromotedAttributes = attributes.some(attr => attr.type === 'label' && attr.name === 'hidePromotedAttributes');

    if (promoted.length > 0 && !hidePromotedAttributes) {
        const $tbody = $("<tbody>");

        for (const definitionAttr of promoted) {
            const definitionType = definitionAttr.type;
            const valueType = definitionType.substr(0, definitionType.length - 11);

            let valueAttrs = attributes.filter(el => el.name === definitionAttr.name && el.type === valueType);

            if (valueAttrs.length === 0) {
                valueAttrs.push({
                    attributeId: "",
                    type: valueType,
                    name: definitionAttr.name,
                    value: ""
                });
            }

            if (definitionAttr.value.multiplicityType === 'singlevalue') {
                valueAttrs = valueAttrs.slice(0, 1);
            }

            for (const valueAttr of valueAttrs) {
                const $tr = await createPromotedAttributeRow(definitionAttr, valueAttr);

                $tbody.append($tr);
            }
        }

        // we replace the whole content in one step so there can't be any race conditions
        // (previously we saw promoted attributes doubling)
        $promotedAttributesContainer.empty().append($tbody);
    }
    else if (note.type !== 'relation-map') {
        if (attributes.length > 0) {
            for (const attribute of attributes) {
                if (attribute.type === 'label') {
                    $attributeListInner.append(utils.formatLabel(attribute) + " ");
                }
                else if (attribute.type === 'relation') {
                    if (attribute.value) {
                        $attributeListInner.append('@' + attribute.name + "=");
                        $attributeListInner.append(await linkService.createNoteLink(attribute.value));
                        $attributeListInner.append(" ");
                    }
                    else {
                        messagingService.logError(`Relation ${attribute.attributeId} has empty target`);
                    }
                }
                else if (attribute.type === 'label-definition' || attribute.type === 'relation-definition') {
                    $attributeListInner.append(attribute.name + " definition ");
                }
                else {
                    messagingService.logError("Unknown attr type: " + attribute.type);
                }
            }

            $attributeList.show();
        }
    }

    return attributes;
}

async function createPromotedAttributeRow(definitionAttr, valueAttr) {
    const definition = definitionAttr.value;
    const $tr = $("<tr>");
    const $labelCell = $("<th>").append(valueAttr.name);
    const $input = $("<input>")
        .prop("tabindex", definitionAttr.position)
        .prop("attribute-id", valueAttr.isOwned ? valueAttr.attributeId : '') // if not owned, we'll force creation of a new attribute instead of updating the inherited one
        .prop("attribute-type", valueAttr.type)
        .prop("attribute-name", valueAttr.name)
        .prop("value", valueAttr.value)
        .addClass("form-control")
        .addClass("promoted-attribute-input")
        .change(promotedAttributeChanged);

    const $inputCell = $("<td>").append($("<div>").addClass("input-group").append($input));

    const $actionCell = $("<td>");
    const $multiplicityCell = $("<td>").addClass("multiplicity");

    $tr
        .append($labelCell)
        .append($inputCell)
        .append($actionCell)
        .append($multiplicityCell);

    if (valueAttr.type === 'label') {
        if (definition.labelType === 'text') {
            $input.prop("type", "text");

            // no need to await for this, can be done asynchronously
            server.get('attributes/values/' + encodeURIComponent(valueAttr.name)).then(attributeValues => {
                if (attributeValues.length === 0) {
                    return;
                }

                attributeValues = attributeValues.map(attribute => { return { value: attribute }; });

                $input.autocomplete({
                    appendTo: document.querySelector('body'),
                    hint: false,
                    autoselect: true,
                    openOnFocus: true,
                    minLength: 0,
                    tabAutocomplete: false
                }, [{
                    displayKey: 'value',
                    source: function (term, cb) {
                        term = term.toLowerCase();

                        const filtered = attributeValues.filter(attr => attr.value.toLowerCase().includes(term));

                        cb(filtered);
                    }
                }]);
            });
        }
        else if (definition.labelType === 'number') {
            $input.prop("type", "number");

            let step = 1;

            for (let i = 0; i < (definition.numberPrecision || 0) && i < 10; i++) {
                step /= 10;
            }

            $input.prop("step", step);
        }
        else if (definition.labelType === 'boolean') {
            $input.prop("type", "checkbox");

            if (valueAttr.value === "true") {
                $input.prop("checked", "checked");
            }
        }
        else if (definition.labelType === 'date') {
            $input.prop("type", "date");
        }
        else if (definition.labelType === 'url') {
            $input.prop("placeholder", "http://website...");

            const $openButton = $("<span>")
                .addClass("input-group-text open-external-link-button jam jam-arrow-up-right")
                .prop("title", "Open external link")
                .click(() => window.open($input.val(), '_blank'));

            $input.after($("<div>")
                .addClass("input-group-append")
                .append($openButton));
        }
        else {
            messagingService.logError("Unknown labelType=" + definitionAttr.labelType);
        }
    }
    else if (valueAttr.type === 'relation') {
        if (valueAttr.value) {
            $input.val(await treeUtils.getNoteTitle(valueAttr.value));
        }

        // no need to wait for this
        noteAutocompleteService.initNoteAutocomplete($input);

        $input.on('autocomplete:selected', function(event, suggestion, dataset) {
            promotedAttributeChanged(event);
        });

        $input.setSelectedPath(valueAttr.value);
    }
    else {
        messagingService.logError("Unknown attribute type=" + valueAttr.type);
        return;
    }

    if (definition.multiplicityType === "multivalue") {
        const addButton = $("<span>")
            .addClass("jam jam-plus pointer")
            .prop("title", "Add new attribute")
            .click(async () => {
                const $new = await createPromotedAttributeRow(definitionAttr, {
                    attributeId: "",
                    type: valueAttr.type,
                    name: definitionAttr.name,
                    value: ""
                });

                $tr.after($new);

                $new.find('input').focus();
            });

        const removeButton = $("<span>")
            .addClass("jam jam-trash-alt pointer")
            .prop("title", "Remove this attribute")
            .click(async () => {
                if (valueAttr.attributeId) {
                    await server.remove("notes/" + noteId + "/attributes/" + valueAttr.attributeId);
                }

                $tr.remove();
            });

        $multiplicityCell.append(addButton).append(" &nbsp;").append(removeButton);
    }

    return $tr;
}

async function promotedAttributeChanged(event) {
    const $attr = $(event.target);

    let value;

    if ($attr.prop("type") === "checkbox") {
        value = $attr.is(':checked') ? "true" : "false";
    }
    else if ($attr.prop("attribute-type") === "relation") {
        const selectedPath = $attr.getSelectedPath();

        value = selectedPath ? treeUtils.getNoteIdFromNotePath(selectedPath) : "";
    }
    else {
        value = $attr.val();
    }

    const result = await server.put("notes/" + noteDetailService.getCurrentNoteId() + "/attribute", {
        attributeId: $attr.prop("attribute-id"),
        type: $attr.prop("attribute-type"),
        name: $attr.prop("attribute-name"),
        value: value
    });

    $attr.prop("attribute-id", result.attributeId);

    // animate only if it's not being animated already, this is important especially for e.g. number inputs
    // which can be changed many times in a second by clicking on higher/lower buttons.
    if ($savedIndicator.queue().length === 0) {
        $savedIndicator.fadeOut();
        $savedIndicator.fadeIn();
    }
}

export default {
    getAttributes,
    showAttributes,
    refreshAttributes
}