import attributesDialog from "../dialogs/attributes.js";
import utils from "../services/utils.js";
import linkService from "../services/link.js";
import messagingService from "../services/messaging.js";

class AttributesWidget {
    /**
     * @param {TabContext} ctx
     * @param {jQuery} $widget
     */
    constructor(ctx, $widget) {
        this.ctx = ctx;
        this.$widget = $widget;
        this.$title = this.$widget.find('.widget-title');
        this.$title.text("Attributes");
        this.$headerActions = this.$widget.find('.widget-header-actions');

        const $showFullButton = $("<a>").append("show dialog").addClass('widget-header-action');
        $showFullButton.click(() => {
            attributesDialog.showDialog();
        });

        this.$headerActions.append($showFullButton);
    }

    async renderBody() {
        const $body = this.$widget.find('.card-body');

        $body.empty();

        const attributes = await this.ctx.attributes.getAttributes();
        const ownedAttributes = attributes.filter(attr => attr.noteId === this.ctx.note.noteId);

        if (ownedAttributes.length === 0) {
            $body.text("No attributes yet...");
            return;
        }

        if (ownedAttributes.length > 0) {
            for (const attribute of ownedAttributes) {
                if (attribute.type === 'label') {
                    $body.append(utils.formatLabel(attribute) + " ");
                }
                else if (attribute.type === 'relation') {
                    if (attribute.value) {
                        $body.append('@' + attribute.name + "=");
                        $body.append(await linkService.createNoteLink(attribute.value));
                        $body.append(" ");
                    }
                    else {
                        messagingService.logError(`Relation ${attribute.attributeId} has empty target`);
                    }
                }
                else if (attribute.type === 'label-definition' || attribute.type === 'relation-definition') {
                    $body.append(attribute.name + " definition ");
                }
                else {
                    messagingService.logError("Unknown attr type: " + attribute.type);
                }
            }
        }
    }
}

export default AttributesWidget;