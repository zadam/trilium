import NoteContextAwareWidget from "../note_context_aware_widget.js";
import AttributeDetailWidget from "../attribute_widgets/attribute_detail.js";
import attributeRenderer from "../../services/attribute_renderer.js";
import attributeService from "../../services/attributes.js";

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

export default class InheritedAttributesWidget extends NoteContextAwareWidget {
    get name() {
        return "inheritedAttributes";
    }

    get toggleCommand() {
        return "toggleRibbonTabInheritedAttributes";
    }

    constructor() {
        super();

        /** @type {AttributeDetailWidget} */
        this.attributeDetailWidget = new AttributeDetailWidget()
            .contentSized()
            .setParent(this);

        this.child(this.attributeDetailWidget);
    }

    getTitle() {
        return {
            show: !this.note.isLaunchBarConfig(),
            title: "Inherited attributes",
            icon: "bx bx-list-plus"
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();

        this.$container = this.$widget.find('.inherited-attributes-container');
        this.$widget.append(this.attributeDetailWidget.render());
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
                .on('click', e => {
                    setTimeout(() =>
                        this.attributeDetailWidget.showAttributeDetail({
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
                        }), 100);
                });

            this.$container
                .append($attr)
                .append(" ");
        }
    }

    getInheritedAttributes(note) {
        return note.getAttributes().filter(attr => attr.noteId !== this.noteId);
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributes(this.componentId).find(attr => attributeService.isAffecting(attr, this.note))) {
            this.refresh();
        }
    }
}
