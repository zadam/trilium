import StandardWidget from "./standard_widget.js";

let linkMapContainerIdCtr = 1;

const TPL = `
<div style="outline: none; overflow: hidden;">
    <div class="link-map-container"></div>
</div>
`;

class LinkMapWidget extends StandardWidget {
    getWidgetTitle() { return "Link map"; }

    getHeaderActions() {
        const $showFullButton = $("<a>").append("show full").addClass('widget-header-action');
        $showFullButton.click(async () => {
            const linkMapDialog = await import("../dialogs/link_map.js");
            linkMapDialog.showDialog();
        });

        return [$showFullButton];
    }

    async doRenderBody() {
        this.$body.html(TPL);

        const $linkMapContainer = this.$body.find('.link-map-container');
        $linkMapContainer.attr("id", "link-map-container-" + linkMapContainerIdCtr++);

        const LinkMapServiceClass = (await import('../services/link_map.js')).default;

        const linkMapService = new LinkMapServiceClass(this.ctx.note, $linkMapContainer);

        await linkMapService.render();
    }
}

export default LinkMapWidget;