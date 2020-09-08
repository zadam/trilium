import TabAwareWidget from "./tab_aware_widget.js";
import AttributeDetailWidget from "./attribute_detail.js";
import attributeRenderer from "../services/attribute_renderer.js";
import AttributeEditorWidget from "./attribute_editor.js";
import options from '../services/options.js';
import PromotedAttributesWidget from "./promoted_attributes.js";

const TPL = `
<div class="attribute-list">
    <style>
        .attribute-list {
            margin-left: 7px;
            margin-right: 7px;
        }
        
        .inherited-attributes-wrapper {
            color: var(--muted-text-color);
            max-height: 200px;
            overflow: auto;
            padding-bottom: 5px;
            padding-left: 7px;
        }
        
        .attribute-list-editor p {
            margin: 0 !important;
        }
        
        .attribute-list.error .attribute-list-editor {
            border-color: red !important;
        }
        
        .attr-expander {
            display: flex; 
            flex-direction: row; 
            color: var(--muted-text-color); 
            font-size: 90%;
            margin: 3px 0 3px 0; 
        }
        
        .attribute-list hr {
            height: 1px;
            border-color: var(--main-border-color);
            position: relative;
            top: 4px;
            margin-top: 5px;
            margin-bottom: 0;
        }
        
        .attr-expander-text {
            padding-left: 20px;
            padding-right: 20px;
            white-space: nowrap;
        }
        
        .attr-expander:hover {
            cursor: pointer;
        }
        
        .attr-expander:hover hr {
            border-color: var(--main-text-color);
        }
        
        .attr-expander:hover .attr-expander-text {
            color: var(--main-text-color);
        }
    </style>
    
    <div class="attr-expander attr-promoted-expander">
        <hr class="w-100">
        
        <div class="attr-expander-text">Promoted attributes</div>
        
        <hr class="w-100">
    </div>
    
    <div class="all-attr-wrapper">
        <div class="promoted-attributes-placeholder"></div>
    
        <div class="attr-expander attr-owned-and-inherited-expander">
            <hr class="w-100">
            
            <div class="attr-expander-text"></div>
            
            <hr class="w-100">
        </div>
        
        <div class="owned-and-inherited-wrapper">
            <div class="attr-editor-placeholder"></div>
            
            <hr class="w-100 attr-inherited-empty-expander" style="margin-bottom: 10px;">
            
            <div class="attr-expander attr-inherited-expander">
                <hr class="w-100">
                
                <div class="attr-expander-text"></div>
                
                <hr class="w-100">
            </div>
            
            <div class="inherited-attributes-wrapper"></div>
        </div>
    </div>
</div>
`;

export default class AttributeListWidget extends TabAwareWidget {
    constructor() {
        super();

        this.promotedAttributesWidget = new PromotedAttributesWidget().setParent(this);
        this.attributeDetailWidget = new AttributeDetailWidget().setParent(this);
        this.attributeEditorWidget = new AttributeEditorWidget(this.attributeDetailWidget).setParent(this);

        this.child(this.promotedAttributesWidget, this.attributeEditorWidget, this.attributeDetailWidget);
    }

    doRender() {
        this.$widget = $(TPL);
        this.overflowing();

        this.$promotedExpander = this.$widget.find('.attr-promoted-expander');
        this.$allAttrWrapper = this.$widget.find('.all-attr-wrapper');

        this.$promotedExpander.on('click', async () => {
            const collapse = this.$allAttrWrapper.is(":visible");

            await options.save('promotedAttributesExpanded', !collapse);

            this.triggerEvent(`promotedAttributesCollapsedStateChanged`, {collapse});
        });

        this.$ownedAndInheritedWrapper = this.$widget.find('.owned-and-inherited-wrapper');

        this.$ownedExpander = this.$widget.find('.attr-owned-and-inherited-expander');
        this.$ownedExpander.on('click', async () => {
            const collapse = this.$ownedAndInheritedWrapper.is(":visible");

            await options.save('attributeListExpanded', !collapse);

            this.triggerEvent(`attributeListCollapsedStateChanged`, {collapse});
        });

        this.$ownedExpanderText = this.$ownedExpander.find('.attr-expander-text');

        this.$inheritedAttributesWrapper = this.$widget.find('.inherited-attributes-wrapper');

        this.$inheritedExpander = this.$widget.find('.attr-inherited-expander');
        this.$inheritedExpander.on('click', () => {
            if (this.$inheritedAttributesWrapper.is(":visible")) {
                this.$inheritedAttributesWrapper.slideUp(200);
            }
            else {
                this.$inheritedAttributesWrapper.slideDown(200);
            }
        });

        this.$inheritedExpanderText = this.$inheritedExpander.find('.attr-expander-text');

        this.$inheritedEmptyExpander = this.$widget.find('.attr-inherited-empty-expander');

        this.$widget.find('.promoted-attributes-placeholder').replaceWith(this.promotedAttributesWidget.render());
        this.$widget.find('.attr-editor-placeholder').replaceWith(this.attributeEditorWidget.render());
        this.$widget.append(this.attributeDetailWidget.render());
    }

    async refreshWithNote(note, updateOnly = false) {
        if (!updateOnly) {
            const hasPromotedAttrs = this.promotedAttributesWidget.getPromotedDefinitionAttributes().length > 0;

            if (hasPromotedAttrs) {
                this.$promotedExpander.show();
                this.$allAttrWrapper.toggle(options.is('promotedAttributesExpanded'));
                this.$ownedAndInheritedWrapper.hide();
                this.$inheritedAttributesWrapper.hide();
            } else {
                this.$promotedExpander.hide();
                this.$allAttrWrapper.show();
                this.$ownedAndInheritedWrapper.toggle(options.is('attributeListExpanded'));
            }
        }

        const ownedAttributes = note.getOwnedAttributes().filter(attr => !attr.isAutoLink);

        this.$ownedExpanderText.text(ownedAttributes.length + ' owned ' + this.attrPlural(ownedAttributes.length));

        const inheritedAttributes = note.getAttributes().filter(attr => attr.noteId !== this.noteId);

        if (inheritedAttributes.length === 0) {
            this.$inheritedExpander.hide();
            this.$inheritedEmptyExpander.show();
        }
        else {
            this.$inheritedExpander.show();
            this.$inheritedEmptyExpander.hide();
        }

        this.$inheritedExpanderText.text(inheritedAttributes.length + ' inherited ' + this.attrPlural(inheritedAttributes.length));

        this.$inheritedAttributesWrapper.empty();

        await this.renderInheritedAttributes(inheritedAttributes, this.$inheritedAttributesWrapper);
    }

    attrPlural(number) {
        return 'attribute' + (number === 1 ? '' : 's');
    }

    async renderInheritedAttributes(attributes, $container) {
        for (const attribute of attributes) {
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

            $container
                .append($attr)
                .append(" ");
        }
    }

    async saveAttributesCommand() {
        await this.attributeEditorWidget.save();
    }

    async reloadAttributesCommand() {
        await this.attributeEditorWidget.refresh();
    }

    updateAttributeListCommand({attributes}) {
        this.attributeEditorWidget.updateAttributeList(attributes);
    }

    /**
     * This event is used to synchronize collapsed state of all the tab-cached widgets since they are all rendered
     * separately but should behave uniformly for the user.
     */
    attributeListCollapsedStateChangedEvent({collapse}) {
        if (collapse) {
            this.$ownedAndInheritedWrapper.slideUp(200);
        } else {
            this.$ownedAndInheritedWrapper.slideDown(200);
        }
    }

    /**
     * This event is used to synchronize collapsed state of all the tab-cached widgets since they are all rendered
     * separately but should behave uniformly for the user.
     */
    promotedAttributesCollapsedStateChangedEvent({collapse}) {
        if (collapse) {
            this.$allAttrWrapper.slideUp(200);
        } else {
            this.$allAttrWrapper.slideDown(200);
        }
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributes(this.componentId).find(attr => attr.isAffecting(this.note))) {
            this.refreshWithNote(this.note, true);
        }
    }
}
