import utils from "../services/utils.js";
import linkService from "../services/link.js";
import messagingService from "../services/messaging.js";
import StandardWidget from "./standard_widget.js";

class AttributesWidget extends StandardWidget {
    getWidgetTitle() { return "Attributes"; }

    getHeaderActions() {
        const $showFullButton = $("<a>").append("show dialog").addClass('widget-header-action');
        $showFullButton.click(async () => {
            const attributesDialog = await import("../dialogs/attributes.js");
            attributesDialog.showDialog();
        });

        return [$showFullButton];
    }

    async doRenderBody() {
        const attributes = await this.ctx.attributes.getAttributes();
        const ownedAttributes = attributes.filter(attr => attr.noteId === this.ctx.note.noteId);

        if (attributes.length === 0) {
            this.$body.text("No attributes yet...");
            return;
        }

        const $attributesContainer = $("<div>");

        await this.renderAttributes(ownedAttributes, $attributesContainer);

        const inheritedAttributes = attributes.filter(attr => attr.noteId !== this.ctx.note.noteId);

        if (inheritedAttributes.length > 0) {
            const $inheritedAttrs = $("<span>").append($("<strong>").text("Inherited: "));
            const $showInheritedAttributes = $("<a>")
                .attr("href", "javascript:")
                .text("+show inherited")
                .click(() => {
                    $showInheritedAttributes.hide();
                    $inheritedAttrs.show();
                });

            const $hideInheritedAttributes = $("<a>")
                .attr("href", "javascript:")
                .text("-hide inherited")
                .click(() => {
                    $showInheritedAttributes.show();
                    $inheritedAttrs.hide();
                });

            $attributesContainer.append($showInheritedAttributes);
            $attributesContainer.append($inheritedAttrs);

            await this.renderAttributes(inheritedAttributes, $inheritedAttrs);

            $inheritedAttrs.append($hideInheritedAttributes);
            $inheritedAttrs.hide();
        }

        this.$body.empty().append($attributesContainer);
    }

    async renderAttributes(attributes, $container) {
        for (const attribute of attributes) {
            if (attribute.type === 'label') {
                $container.append(utils.formatLabel(attribute) + " ");
            } else if (attribute.type === 'relation') {
                if (attribute.value) {
                    $container.append('@' + attribute.name + "=");
                    $container.append(await linkService.createNoteLink(attribute.value));
                    $container.append(" ");
                } else {
                    messagingService.logError(`Relation ${attribute.attributeId} has empty target`);
                }
            } else if (attribute.type === 'label-definition' || attribute.type === 'relation-definition') {
                $container.append(attribute.name + " definition ");
            } else {
                messagingService.logError("Unknown attr type: " + attribute.type);
            }
        }
    }

    syncDataReceived(syncData) {
        if (syncData.find(sd => sd.entityName === 'attributes' && sd.noteId === this.ctx.note.noteId)) {
            // no need to invalidate attributes since the Attribute class listens to this as well
            // (and is guaranteed to run first)
            this.doRenderBody();
        }
    }
}

export default AttributesWidget;