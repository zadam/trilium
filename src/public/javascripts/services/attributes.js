import server from "./server.js";
import utils from "./utils.js";
import messagingService from "./messaging.js";
import treeUtils from "./tree_utils.js";
import noteAutocompleteService from "./note_autocomplete.js";
import linkService from "./link.js";

class Attributes {
    /**
     * @param {TabContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.$attributeList = ctx.$tabContent.find(".attribute-list");
        this.$attributeListInner = ctx.$tabContent.find(".attribute-list-inner");
        this.$promotedAttributesContainer = ctx.$tabContent.find(".note-detail-promoted-attributes");
        this.$savedIndicator = ctx.$tabContent.find(".saved-indicator");
        this.attributePromise = null;
    }

    invalidateAttributes() {
        this.attributePromise = null;
    }

    reloadAttributes() {
        this.attributePromise = server.get(`notes/${this.ctx.note.noteId}/attributes`);
    }

    async refreshAttributes() {
        this.reloadAttributes();

        await this.showAttributes();
    }

    async getAttributes() {
        if (!this.attributePromise) {
            this.reloadAttributes();
        }

        return await this.attributePromise;
    }

    async showAttributes() {
        this.$promotedAttributesContainer.empty();
        this.$attributeList.hide();
        this.$attributeListInner.empty();

        const note = this.ctx.note;

        const attributes = await this.getAttributes();

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
                    const $tr = await this.createPromotedAttributeRow(definitionAttr, valueAttr);

                    $tbody.append($tr);
                }
            }

            // we replace the whole content in one step so there can't be any race conditions
            // (previously we saw promoted attributes doubling)
            this.$promotedAttributesContainer.empty().append($tbody);
        }
        else if (note.type !== 'relation-map') {
            // display only "own" notes
            const ownedAttributes = attributes.filter(attr => attr.noteId === note.noteId);

            if (ownedAttributes.length > 0) {
                for (const attribute of ownedAttributes) {
                    if (attribute.type === 'label') {
                        this.$attributeListInner.append(utils.formatLabel(attribute) + " ");
                    }
                    else if (attribute.type === 'relation') {
                        if (attribute.value) {
                            this.$attributeListInner.append('@' + attribute.name + "=");
                            this.$attributeListInner.append(await linkService.createNoteLink(attribute.value));
                            this.$attributeListInner.append(" ");
                        }
                        else {
                            messagingService.logError(`Relation ${attribute.attributeId} has empty target`);
                        }
                    }
                    else if (attribute.type === 'label-definition' || attribute.type === 'relation-definition') {
                        this.$attributeListInner.append(attribute.name + " definition ");
                    }
                    else {
                        messagingService.logError("Unknown attr type: " + attribute.type);
                    }
                }

                this.$attributeList.show();
            }
        }

        return attributes;
    }

    async createPromotedAttributeRow(definitionAttr, valueAttr) {
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
            .change(event => this.promotedAttributeChanged(event));

        const $inputCell = $("<td>").append($("<div>").addClass("input-group").append($input));

        const $actionCell = $("<td>");
        const $multiplicityCell = $("<td>")
            .addClass("multiplicity")
            .attr("nowrap", true);

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
                        autoselect: false,
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

            $input.on('autocomplete:selected', (event, suggestion, dataset) => {
                this.promotedAttributeChanged(event);
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
                    const $new = await this.createPromotedAttributeRow(definitionAttr, {
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

    async promotedAttributeChanged(event) {
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

        const result = await server.put(`notes/${this.ctx.note.noteId}/attribute`, {
            attributeId: $attr.prop("attribute-id"),
            type: $attr.prop("attribute-type"),
            name: $attr.prop("attribute-name"),
            value: value
        });

        $attr.prop("attribute-id", result.attributeId);

        // animate only if it's not being animated already, this is important especially for e.g. number inputs
        // which can be changed many times in a second by clicking on higher/lower buttons.
        if (this.$savedIndicator.queue().length === 0) {
            this.$savedIndicator.fadeOut();
            this.$savedIndicator.fadeIn();
        }
    }
}

export default Attributes;