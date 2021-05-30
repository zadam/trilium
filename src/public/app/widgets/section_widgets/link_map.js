import NoteContextAwareWidget from "../note_context_aware_widget.js";
import froca from "../../services/froca.js";

const TPL = `
<div class="link-map-widget">
    <style>
        .link-map-widget {
            position: relative;
        }
        
        .link-map-container {
            height: 300px;
        }
    
        .open-full-dialog-button {
            position: absolute;
            right: 10px;
            top: 10px;
            z-index: 1000;
        }
    </style>

    <button class="bx bx-expand icon-action open-full-dialog-button" title="Show Link Map dialog"></button>

    <div class="link-map-container"></div>
</div>`;

export default class LinkMapWidget extends NoteContextAwareWidget {
    isEnabled() {
        return this.note;
    }

    getTitle() {
        return {
            show: this.isEnabled(),
            title: 'Link Map',
            icon: 'bx bx-network-chart'
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.$widget.find('.open-full-dialog-button').on('click', () => this.triggerCommand('showLinkMap'));
        this.overflowing();
    }

    async refreshWithNote(note) {
        this.$widget.find(".link-map-container").empty();

        const $linkMapContainer = this.$widget.find('.link-map-container');

        const LinkMapServiceClass = (await import('../../services/link_map.js')).default;

        this.linkMapService = new LinkMapServiceClass(note, $linkMapContainer, {
            maxDepth: 3,
            zoom: 0.6,
            width: $linkMapContainer.width(),
            height: $linkMapContainer.height()
        });

        await this.linkMapService.render();
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

        const changedNoteIds = loadResults.getNoteIds();

        if (changedNoteIds.length > 0) {
            const $linkMapContainer = this.$widget.find('.link-map-container');

            for (const noteId of changedNoteIds) {
                const note = froca.notes[noteId];

                if (note) {
                    $linkMapContainer.find(`a[data-note-path="${noteId}"]`).text(note.title);
                }
            }
        }
    }
}
