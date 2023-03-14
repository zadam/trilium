import NoteContextAwareWidget from "../note_context_aware_widget.js";
import AttributeDetailWidget from "../attribute_widgets/attribute_detail.js";
import AttributeEditorWidget from "../attribute_widgets/attribute_editor.js";
import attributeService from "../../services/attributes.js";

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

export default class OwnedAttributeListWidget extends NoteContextAwareWidget {
    get name() {
        return "ownedAttributes";
    }

    get toggleCommand() {
        return "toggleRibbonTabOwnedAttributes";
    }

    constructor() {
        super();

        this.attributeDetailWidget = new AttributeDetailWidget()
            .contentSized()
            .setParent(this);

        this.attributeEditorWidget = new AttributeEditorWidget(this.attributeDetailWidget)
            .contentSized()
            .setParent(this);

        this.child(this.attributeEditorWidget, this.attributeDetailWidget);
    }

    getTitle() {
        return {
            show: !this.note.isLaunchBarConfig(),
            title: "Owned Attributes",
            icon: "bx bx-list-check"
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();

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
        if (loadResults.getAttributes(this.componentId).find(attr => attributeService.isAffecting(attr, this.note))) {
            this.refreshWithNote(this.note, true);

            this.getTitle(this.note);
        }
    }

    focus() {
        this.attributeEditorWidget.focus();
    }
}
