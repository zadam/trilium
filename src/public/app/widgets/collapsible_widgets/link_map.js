import CollapsibleWidget from "../collapsible_widget.js";

let linkMapContainerIdCtr = 1;

const TPL = `
<div class="link-map-widget">
    <div class="link-map-container" style="height: 300px;"></div>
</div>
`;

export default class LinkMapWidget extends CollapsibleWidget {
    get widgetTitle() { return "Link map"; }

    get help() {
        return {
            title: "Link map shows incoming and outgoing links from/to the current note.",
            url: "https://github.com/zadam/trilium/wiki/Link-map"
        };
    }

    get headerActions() {
        const $showFullButton = $("<a>").append("show full").addClass('widget-header-action');
        $showFullButton.on('click', async () => {
            const linkMapDialog = await import("../../dialogs/link_map.js");
            linkMapDialog.showDialog();
        });

        return [$showFullButton];
    }

    decorateWidget() {
        this.$body.css("max-height", "400px");
    }

    async refreshWithNote(note) {
        const noteId = this.noteId;

        let shown = false;

        // avoid executing this expensive operation multiple times when just going through notes (with keyboard especially)
        // until the users settles on a note
        setTimeout(() => {
            if (this.noteId === noteId) {
                // there's a problem with centering the rendered link map before it is actually shown on the screen
                // that's why we make the whole process lazy and with the help of IntersectionObserver wait until the
                // tab is really shown and only then render
                const observer = new IntersectionObserver(entries => {
                    if (!shown && entries[0].isIntersecting) {
                        shown = true;
                        this.displayLinkMap(note);
                    }
                }, {
                    rootMargin: '0px',
                    threshold: 0.1
                });

                observer.observe(this.$body[0]);
            }
        }, 1000);
    }

    async displayLinkMap(note) {
        this.$body.css('opacity', 0);
        this.$body.html(TPL);

        const $linkMapContainer = this.$body.find('.link-map-container');
        $linkMapContainer.attr("id", "link-map-container-" + linkMapContainerIdCtr++);

        const LinkMapServiceClass = (await import('../../services/link_map.js')).default;

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
            this.noteSwitched();
        }
    }
}