import StandardWidget from "./standard_widget.js";

let linkMapContainerIdCtr = 1;

const TPL = `
<div class="link-map-widget">
    <div class="link-map-container"></div>
</div>
`;

class LinkMapWidget extends StandardWidget {
    getWidgetTitle() { return "Link map"; }

    getHelp() {
        return {
            title: "Link map shows incoming and outgoing links from/to the current note.",
            url: "https://github.com/zadam/trilium/wiki/Link-map"
        };
    }

    getHeaderActions() {
        const $showFullButton = $("<a>").append("show full").addClass('widget-header-action');
        $showFullButton.on('click', async () => {
            const linkMapDialog = await import("../dialogs/link_map.js");
            linkMapDialog.showDialog();
        });

        return [$showFullButton];
    }

    async activeTabChanged() {
        this.$body.css('opacity', 0);
        this.$body.html(TPL);

        const $linkMapContainer = this.$body.find('.link-map-container');
        $linkMapContainer.attr("id", "link-map-container-" + linkMapContainerIdCtr++);
        $linkMapContainer.css("height", "300px");

        const LinkMapServiceClass = (await import('../services/link_map.js')).default;

        this.linkMapService = new LinkMapServiceClass(this.tabContext.note, $linkMapContainer, {
            maxDepth: 1,
            zoom: 0.6
        });

        await this.linkMapService.render();

        this.$body.animate({opacity: 1}, 300);
    }

    cleanup() {
        if (this.linkMapService) {
            this.linkMapService.cleanup();
        }
    }

    syncDataListener({data}) {
        if (data.find(sd => sd.entityName === 'attributes' && sd.noteId === this.tabContext.note.noteId)) {
            // no need to invalidate attributes since the Attribute class listens to this as well
            // (and is guaranteed to run first)
            if (this.linkMapService) {
                this.linkMapService.loadNotesAndRelations();
            }
        }
    }
}

export default LinkMapWidget;