import TabAwareWidget from "./tab_aware_widget.js";
import AttributeDetailWidget from "./attribute_widgets/attribute_detail.js";
import attributeRenderer from "../services/attribute_renderer.js";

const TPL = `
<div class="inherited-attributes-widget">
    <style>
    .inherited-attributes-widget {
        position: relative;
    }
    
    .inherited-attributes-container {
        color: var(--muted-text-color);
        max-height: 200px;
        overflow: auto;
        padding: 12px 12px 11px 12px;
    }
    </style>

    <div class="inherited-attributes-container"></div>
</div>`;

export default class InheritedAttributesWidget extends TabAwareWidget {
    constructor() {
        super();

        this.attributeDetailWidget = new AttributeDetailWidget().setParent(this);
        this.child(this.attributeDetailWidget);
    }

    renderTitle(note) {
        const inheritedAttributes = this.getInheritedAttributes(note);

        this.$title.text(`Inherited attrs (${inheritedAttributes.length})`);

        return {
            show: true,
            $title: this.$title
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.overflowing();

        this.$container = this.$widget.find('.inherited-attributes-container');
        this.$widget.append(this.attributeDetailWidget.render());

        this.$title = $('<div>');
    }

    async refreshWithNote(note) {
        this.$container.empty();

        const inheritedAttributes = this.getInheritedAttributes(note);

        if (inheritedAttributes.length === 0) {
            this.$container.append("No inherited attributes.");
            return;
        }

        for (const attribute of inheritedAttributes) {
            const $attr = (await attributeRenderer.renderAttribute(attribute, false))
                .on('click', e => this.attributeDetailWidget.showAttributeDetail({
                    attribute: {
                        noteId: attribute.noteId,
                        type: attribute.type,
                        name: attribute.name,
                        value: attribute.value,
                        isInheritable: attribute.isInheritable
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

    getInheritedAttributes(note) {
        return note.getAttributes().filter(attr => attr.noteId !== this.noteId);
    }
}
