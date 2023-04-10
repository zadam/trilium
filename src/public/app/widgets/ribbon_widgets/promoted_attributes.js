import server from "../../services/server.js";
import ws from "../../services/ws.js";
import treeService from "../../services/tree.js";
import noteAutocompleteService from "../../services/note_autocomplete.js";
import NoteContextAwareWidget from "../note_context_aware_widget.js";
import attributeService from "../../services/attributes.js";

const TPL = `
<div>
    <style>
    .promoted-attributes-container {
        margin: auto;
        display: flex;
        flex-direction: row;
        flex-shrink: 0;
        flex-grow: 0;
        justify-content: space-evenly;
        overflow: auto;
        max-height: 400px;
        flex-wrap: wrap;
    }
    
    .promoted-attribute-cell {
        display: flex;
        align-items: center;
        margin: 10px;
    }
    
    .promoted-attribute-cell div.input-group {
        margin-left: 10px;
    }
    .promoted-attribute-cell strong {
        word-break:keep-all;
    }
    </style>
    
    <div class="promoted-attributes-container"></div>
</div>
`;

export default class PromotedAttributesWidget extends NoteContextAwareWidget {
    get name() {
        return "promotedAttributes";
    }

    get toggleCommand() {
        return "toggleRibbonTabPromotedAttributes";
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$container = this.$widget.find(".promoted-attributes-container");
    }

    getTitle(note) {
        const promotedDefAttrs = note.getPromotedDefinitionAttributes();

        if (promotedDefAttrs.length === 0) {
            return {show: false};
        }

        return {
            show: true,
            activate: true,
            title: "Promoted Attributes",
            icon: "bx bx-table"
        };
    }

    async refreshWithNote(note) {
        this.$container.empty();

        const promotedDefAttrs = note.getPromotedDefinitionAttributes();
        const ownedAttributes = note.getOwnedAttributes();

        if (promotedDefAttrs.length === 0) {
            this.toggleInt(false);
            return;
        }

        const $cells = [];

        for (const definitionAttr of promotedDefAttrs) {
            const valueType = definitionAttr.name.startsWith('label:') ? 'label' : 'relation';
            const valueName = definitionAttr.name.substr(valueType.length + 1);

            let valueAttrs = ownedAttributes.filter(el => el.name === valueName && el.type === valueType);

            if (valueAttrs.length === 0) {
                valueAttrs.push({
                    attributeId: "",
                    type: valueType,
                    name: valueName,
                    value: ""
                });
            }

            if (definitionAttr.getDefinition().multiplicity === 'single') {
                valueAttrs = valueAttrs.slice(0, 1);
            }

            for (const valueAttr of valueAttrs) {
                const $cell = await this.createPromotedAttributeCell(definitionAttr, valueAttr, valueName);

                $cells.push($cell);
            }
        }

        // we replace the whole content in one step so there can't be any race conditions
        // (previously we saw promoted attributes doubling)
        this.$container.empty().append(...$cells);
        this.toggleInt(true);
    }

    async createPromotedAttributeCell(definitionAttr, valueAttr, valueName) {
        const definition = definitionAttr.getDefinition();

        const $input = $("<input>")
            .prop("tabindex", 200 + definitionAttr.position)
            .attr("data-attribute-id", valueAttr.noteId === this.noteId ? valueAttr.attributeId : '') // if not owned, we'll force creation of a new attribute instead of updating the inherited one
            .attr("data-attribute-type", valueAttr.type)
            .attr("data-attribute-name", valueAttr.name)
            .prop("value", valueAttr.value)
            .addClass("form-control")
            .addClass("promoted-attribute-input")
            .on('change', event => this.promotedAttributeChanged(event));

        const $actionCell = $("<div>");
        const $multiplicityCell = $("<td>")
            .addClass("multiplicity")
            .attr("nowrap", true);

        const $wrapper = $('<div class="promoted-attribute-cell">')
            .append($("<strong>").text(valueName))
            .append($("<div>").addClass("input-group").append($input))
            .append($actionCell)
            .append($multiplicityCell);

        if (valueAttr.type === 'label') {
            if (definition.labelType === 'text') {
                $input.prop("type", "text");

                // no need to await for this, can be done asynchronously
                server.get(`attributes/values/${encodeURIComponent(valueAttr.name)}`).then(attributeValues => {
                    if (attributeValues.length === 0) {
                        return;
                    }

                    attributeValues = attributeValues.map(attribute => ({value: attribute}));

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

                    $input.on('autocomplete:selected', e => this.promotedAttributeChanged(e));
                });
            }
            else if (definition.labelType === 'number') {
                $input.prop("type", "number");

                let step = 1;

                for (let i = 0; i < (definition.numberPrecision || 0) && i < 10; i++) {
                    step /= 10;
                }

                $input.prop("step", step);
                $input
                    .css("text-align", "right")
                    .css("width", "120");
            }
            else if (definition.labelType === 'boolean') {
                $input.prop("type", "checkbox");
                // hack, without this the checkbox is invisible
                // we should be using a different bootstrap structure for checkboxes
                $input.css('width', '80px');

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
                    .addClass("input-group-text open-external-link-button bx bx-window-open")
                    .prop("title", "Open external link")
                    .on('click', () => window.open($input.val(), '_blank'));

                $input.after($("<div>")
                    .addClass("input-group-append")
                    .append($openButton));
            }
            else {
                ws.logError(`Unknown labelType=${definitionAttr.labelType}`);
            }
        }
        else if (valueAttr.type === 'relation') {
            if (valueAttr.value) {
                $input.val(await treeService.getNoteTitle(valueAttr.value));
            }

            // no need to wait for this
            noteAutocompleteService.initNoteAutocomplete($input, {allowCreatingNotes: true});

            $input.on('autocomplete:noteselected', (event, suggestion, dataset) => {
                this.promotedAttributeChanged(event);
            });

            $input.setSelectedNotePath(valueAttr.value);
        }
        else {
            ws.logError(`Unknown attribute type=${valueAttr.type}`);
            return;
        }

        if (definition.multiplicity === "multi") {
            const $addButton = $("<span>")
                .addClass("bx bx-plus pointer")
                .prop("title", "Add new attribute")
                .on('click', async () => {
                    const $new = await this.createPromotedAttributeCell(definitionAttr, {
                        attributeId: "",
                        type: valueAttr.type,
                        name: valueName,
                        value: ""
                    }, valueName);

                    $wrapper.after($new);

                    $new.find('input').trigger('focus');
                });

            const $removeButton = $("<span>")
                .addClass("bx bx-trash pointer")
                .prop("title", "Remove this attribute")
                .on('click', async () => {
                    const attributeId = $input.attr("data-attribute-id");

                    if (attributeId) {
                        await server.remove(`notes/${this.noteId}/attributes/${attributeId}`, this.componentId);
                    }

                    // if it's the last one the create new empty form immediately
                    const sameAttrSelector = `input[data-attribute-type='${valueAttr.type}'][data-attribute-name='${valueName}']`;

                    if (this.$widget.find(sameAttrSelector).length <= 1) {
                        const $new = await this.createPromotedAttributeCell(definitionAttr, {
                            attributeId: "",
                            type: valueAttr.type,
                            name: valueName,
                            value: ""
                        }, valueName);

                        $wrapper.after($new);
                    }

                    $wrapper.remove();
                });

            $multiplicityCell
                .append(" &nbsp;")
                .append($addButton)
                .append(" &nbsp;")
                .append($removeButton);
        }

        return $wrapper;
    }

    async promotedAttributeChanged(event) {
        const $attr = $(event.target);

        let value;

        if ($attr.prop("type") === "checkbox") {
            value = $attr.is(':checked') ? "true" : "false";
        }
        else if ($attr.attr("data-attribute-type") === "relation") {
            const selectedPath = $attr.getSelectedNotePath();

            value = selectedPath ? treeService.getNoteIdFromNotePath(selectedPath) : "";
        }
        else {
            value = $attr.val();
        }

        const result = await server.put(`notes/${this.noteId}/attribute`, {
            attributeId: $attr.attr("data-attribute-id"),
            type: $attr.attr("data-attribute-type"),
            name: $attr.attr("data-attribute-name"),
            value: value
        }, this.componentId);

        $attr.attr("data-attribute-id", result.attributeId);
    }

    focus() {
        this.$widget.find(".promoted-attribute-input:first").focus();
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributes(this.componentId).find(attr => attributeService.isAffecting(attr, this.note))) {
            this.refresh();
        }
    }
}
