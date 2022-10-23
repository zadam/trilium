import TypeWidget from "./type_widget.js";
import appContext from "../../services/app_context.js";
import froca from "../../services/froca.js";
import linkService from "../../services/link.js";
import noteContentRenderer from "../../services/note_content_renderer.js";

export default class AbstractTextTypeWidget extends TypeWidget {
    setupImageOpening(singleClickOpens) {
        this.$widget.on("dblclick", "img", e => this.openImageInCurrentTab($(e.target)));

        this.$widget.on("click", "img", e => {
            if ((e.which === 1 && e.ctrlKey) || e.which === 2) {
                this.openImageInNewTab($(e.target));
            }
            else if (e.which === 1 && singleClickOpens) {
                this.openImageInCurrentTab($(e.target));
            }
        });
    }

    openImageInCurrentTab($img) {
        const imgSrc = $img.prop("src");
        const noteId = this.getNoteIdFromImage(imgSrc);

        if (noteId) {
            appContext.tabManager.getActiveContext().setNote(noteId);
        } else {
            window.open(imgSrc, '_blank');
        }
    }

    openImageInNewTab($img) {
        const imgSrc = $img.prop("src");
        const noteId = this.getNoteIdFromImage(imgSrc);

        if (noteId) {
            appContext.tabManager.openTabWithNoteWithHoisting(noteId);
        } else {
            window.open(imgSrc, '_blank');
        }
    }

    getNoteIdFromImage(imgSrc) {
        const match = imgSrc.match(/\/api\/images\/([A-Za-z0-9]+)\//);

        return match ? match[1] : null;
    }

    async loadIncludedNote(noteId, $el) {
        const note = await froca.getNote(noteId);

        if (note) {
            const $wrapper = $('<div class="include-note-wrapper">');

            const $link = await linkService.createNoteLink(note.noteId, {
                showTooltip: false
            });

            $wrapper.empty().append(
                $('<h4 class="include-note-title">')
                    .append($link)
            );

            const {$renderedContent, type} = await noteContentRenderer.getRenderedContent(note);

            $wrapper.append(
                $(`<div class="include-note-content type-${type}">`)
                    .append($renderedContent)
            );

            $el.empty().append($wrapper);
        }
    }

    async loadReferenceLinkTitle(noteId, $el) {
        await linkService.loadReferenceLinkTitle(noteId, $el);
    }

    refreshIncludedNote($container, noteId) {
        if ($container) {
            $container.find(`section[data-note-id="${noteId}"]`).each((_, el) => {
                this.loadIncludedNote(noteId, $(el));
            });
        }
    }
}
