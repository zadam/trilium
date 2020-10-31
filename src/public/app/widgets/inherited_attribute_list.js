import TabAwareWidget from "./tab_aware_widget.js";
import AttributeDetailWidget from "./attribute_detail.js";
import attributeRenderer from "../services/attribute_renderer.js";

const TPL = `
<div class="inherited-attributes-widget">
    <style>
    .inherited-attributes-container {
        color: var(--muted-text-color);
        max-height: 200px;
        overflow: auto;
        padding-top: 10px;
        padding-bottom: 10px;
        padding-left: 7px;
    }
    </style>

    <div class="inherited-attributes-container"></div>
</div>`

export default class InheritedAttributesWidget extends TabAwareWidget {
    constructor() {
        super();

        this.attributeDetailWidget = new AttributeDetailWidget().setParent(this);
        this.child(this.attributeDetailWidget);
    }

    renderTitle() {
        this.$title = $('<div>').text('Inherited attributes');
        return this.$title;
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();

        this.$container = this.$widget.find('.inherited-attributes-container');
        this.$widget.append(this.attributeDetailWidget.render());
    }

    async refreshWithNote(note) {
        this.$container.empty();

        const inheritedAttributes = note.getAttributes().filter(attr => attr.noteId !== this.noteId);

        for (const attribute of inheritedAttributes) {
            const $attr = (await attributeRenderer.renderAttribute(attribute, false))
                .on('click', e => this.attributeDetailWidget.showAttributeDetail({
                    attribute: {
                        noteId: attribute.noteId,
                        type: attribute.type,
                        name: attribute.name,
                        value: attribute.value
                    },
                    isOwned: false,
                    x: e.pageX,
                    y: e.pageY
                }));

            this.$container
                .append($attr)
                .append(" ");
        }
    }
}
