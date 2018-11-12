import server from "./server.js";
import utils from "./utils.js";
import messagingService from "./messaging.js";
import treeUtils from "./tree_utils.js";
import noteAutocompleteService from "./note_autocomplete.js";
import treeService from "./tree.js";
import linkService from "./link.js";
import infoService from "./info.js";
import noteDetailService from "./note_detail.js";

const $attributeList = $("#attribute-list");
const $attributeListInner = $("#attribute-list-inner");
const $promotedAttributesContainer = $("#note-detail-promoted-attributes");

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

    const noteId = noteDetailService.getCurrentNoteId();

    const attributes = await attributePromise;

    const promoted = attributes.filter(attr =>
        (attr.type === 'label-definition' || attr.type === 'relation-definition')
        && !attr.name.startsWith("child:")
        && attr.value.isPromoted);

    let idx = 1;

    async function createRow(definitionAttr, valueAttr) {
        const definition = definitionAttr.value;
        const inputId = "promoted-input-" + idx;
        const $tr = $("<tr>");
        const $labelCell = $("<th>").append(valueAttr.name);
        const $input = $("<input>")
            .prop("id", inputId)
            .prop("tabindex", definitionAttr.position)
            .prop("attribute-id", valueAttr.isOwned ? valueAttr.attributeId : '') // if not owned, we'll force creation of a new attribute instead of updating the inherited one
            .prop("attribute-type", valueAttr.type)
            .prop("attribute-name", valueAttr.name)
            .prop("value", valueAttr.value)
            .addClass("form-control")
            .addClass("promoted-attribute-input")
            .change(promotedAttributeChanged);

        idx++;

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
                        minLength: 0
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
            }
            else if (definition.labelType === 'boolean') {
                $input.prop("type", "checkbox");

                if (valueAttr.value === "true") {
                    $input.prop("checked", "checked");
                }
            }
            else if (definition.labelType === 'date') {
                $input.prop("type", "date");

                const $todayButton = $("<button>").addClass("btn btn-sm").text("Today").click(() => {
                    $input.val(utils.formatDateISO(new Date()));
                    $input.trigger("change");
                });

                $actionCell.append($todayButton);
            }
            else if (definition.labelType === 'url') {
                $input.prop("placeholder", "http://website...");

                const $openButton = $("<button>").addClass("btn btn-sm").text("Open").click(() => {
                    window.open($input.val(), '_blank');
                });

                $actionCell.append($openButton);
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

            $input.prop("data-selected-path", valueAttr.value);

            // ideally we'd use link instead of button which would allow tooltip preview, but
            // we can't guarantee updating the link in the a element
            const $openButton = $("<button>").addClass("btn btn-sm").text("Open").click(() => {
                const notePath = $input.getSelectedPath();

                if (notePath) {
                    treeService.activateNote(notePath);
                }
                else {
                    console.log("Empty note path, nothing to open.");
                }
            });

            $actionCell.append($openButton);
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
                    const $new = await createRow(definitionAttr, {
                        attributeId: "",
                        type: valueAttr.type,
                        name: definitionAttr.name,
                        value: ""
                    });

                    $tr.after($new);

                    $new.find('input').focus();
                });

            const removeButton = $("<span>")
                .addClass("jam jam-trash pointer")
                .prop("title", "Remove this attribute")
                .click(async () => {
                    if (valueAttr.attributeId) {
                        await server.remove("notes/" + noteId + "/attributes/" + valueAttr.attributeId);
                    }

                    $tr.remove();
                });

            $multiplicityCell.append(addButton).append(" &nbsp; ").append(removeButton);
        }

        return $tr;
    }

    if (promoted.length > 0) {
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
                const $tr = await createRow(definitionAttr, valueAttr);

                $tbody.append($tr);
            }
        }

        // we replace the whole content in one step so there can't be any race conditions
        // (previously we saw promoted attributes doubling)
        $promotedAttributesContainer.empty().append($tbody);
    }
    else {
        $attributeListInner.empty();

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

    infoService.showMessage("Attribute has been saved.");
}

export default {
    getAttributes,
    showAttributes,
    refreshAttributes
}