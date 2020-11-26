import TabAwareWidget from "../tab_aware_widget.js";
import AttributeDetailWidget from "./attribute_detail.js";
import AttributeEditorWidget from "./attribute_editor.js";

const TPL = `
<div class="attribute-list">
    <style>
        .attribute-list {
            margin-left: 7px;
            margin-right: 7px;
            margin-top: 3px;
            position: relative;
        }
        
        .attribute-list-editor p {
            margin: 0 !important;
        }
    </style>
   
    <div class="attr-editor-placeholder"></div>
</div>
`;

export default class OwnedAttributeListWidget extends TabAwareWidget {
    constructor() {
        super();

        this.attributeDetailWidget = new AttributeDetailWidget().setParent(this);
        this.attributeEditorWidget = new AttributeEditorWidget(this.attributeDetailWidget).setParent(this);

        this.child(this.attributeEditorWidget, this.attributeDetailWidget);
    }

    renderTitle(note) {
        const ownedAttrs = note.getAttributes().filter(attr => attr.noteId === this.noteId && !attr.isAutoLink)

        this.$title.text(`Owned attrs (${ownedAttrs.length})`);

        return {
            show: true,
            $title: this.$title
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.overflowing();

        this.$widget.find('.attr-editor-placeholder').replaceWith(this.attributeEditorWidget.render());
        this.$widget.append(this.attributeDetailWidget.render());

        this.$title = $('<div>');
    }

    async saveAttributesCommand() {
        await this.attributeEditorWidget.save();
    }

    async reloadAttributesCommand() {
        await this.attributeEditorWidget.refresh();
    }

    async updateAttributeListCommand({attributes}) {
        await this.attributeEditorWidget.updateAttributeList(attributes);
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributes(this.componentId).find(attr => attr.isAffecting(this.note))) {
            this.refreshWithNote(this.note, true);

            this.renderTitle(this.note);
        }
    }
}
