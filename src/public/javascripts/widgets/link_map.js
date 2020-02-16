import CollapsibleWidget from "./collapsible_widget.js";

let linkMapContainerIdCtr = 1;

const TPL = `
<div class="link-map-widget">
    <div class="link-map-container"></div>
</div>
`;

export default class LinkMapWidget extends CollapsibleWidget {
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

    noteSwitched() {
        const noteId = this.noteId;

        // avoid executing this expensive operation multiple times when just going through notes (with keyboard especially)
        // until the users settles on a note
        setTimeout(() => {
            if (this.noteId === noteId) {
                this.refresh();
            }
        }, 1000);
    }

    async refreshWithNote(note) {
        this.$body.css('opacity', 0);
        this.$body.html(TPL);

        const $linkMapContainer = this.$body.find('.link-map-container');
        $linkMapContainer.attr("id", "link-map-container-" + linkMapContainerIdCtr++);
        $linkMapContainer.css("height", "300px");

        const LinkMapServiceClass = (await import('../services/link_map.js')).default;

        this.linkMapService = new LinkMapServiceClass(note, $linkMapContainer, {
            maxDepth: 1,
            zoom: 0.6,
            stopCheckerCallback: () => this.noteId !== note.noteId // stop when current note is not what was originally requested
        });

        await this.linkMapService.render();

        this.$body.animate({opacity: 1}, 300);
    }

    cleanup() {
        if (this.linkMapService) {
            this.linkMapService.cleanup();
        }
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributes().find(attr => attr.type === 'relation' && (attr.noteId === this.noteId || attr.value === this.noteId))) {
            this.refresh();
        }
    }
}