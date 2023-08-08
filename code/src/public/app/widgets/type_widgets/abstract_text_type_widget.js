import TypeWidget from "./type_widget.js";
import appContext from "../../components/app_context.js";
import froca from "../../services/froca.js";
import linkService from "../../services/link.js";
import contentRenderer from "../../services/content_renderer.js";
import utils from "../../services/utils.js";

export default class AbstractTextTypeWidget extends TypeWidget {
    setupImageOpening(singleClickOpens) {
        this.$widget.on("dblclick", "img", e => this.openImageInCurrentTab($(e.target)));

        this.$widget.on("click", "img", e => {
            const isLeftClick = e.which === 1;
            const isMiddleClick = e.which === 2;
            const ctrlKey = utils.isCtrlKey(e);

            if ((isLeftClick && ctrlKey) || isMiddleClick) {
                this.openImageInNewTab($(e.target));
            }
            else if (isLeftClick && singleClickOpens) {
                this.openImageInCurrentTab($(e.target));
            }
        });
    }

    async openImageInCurrentTab($img) {
        const { noteId, viewScope } = await this.parseFromImage($img);

        if (noteId) {
            appContext.tabManager.getActiveContext().setNote(noteId, { viewScope });
        } else {
            window.open($img.prop("src"), '_blank');
        }
    }

    openImageInNewTab($img) {
        const { noteId, viewScope } = this.parseFromImage($img);

        if (noteId) {
            appContext.tabManager.openTabWithNoteWithHoisting(noteId, { viewScope });
        } else {
            window.open($img.prop("src"), '_blank');
        }
    }

    async parseFromImage($img) {
        const imgSrc = $img.prop("src");

        const imageNoteMatch = imgSrc.match(/\/api\/images\/([A-Za-z0-9_]+)\//);
        if (imageNoteMatch) {
            return {
                noteId: imageNoteMatch[1],
                viewScope: {}
            }
        }

        const attachmentMatch = imgSrc.match(/\/api\/attachments\/([A-Za-z0-9_]+)\/image\//);
        if (attachmentMatch) {
            const attachmentId = attachmentMatch[1];
            const attachment = await froca.getAttachment(attachmentId);

            return {
                noteId: attachment.ownerId,
                viewScope: {
                    viewMode: 'attachments',
                    attachmentId: attachmentId
                }
            }
        }

        return null;
    }

    async loadIncludedNote(noteId, $el) {
        const note = await froca.getNote(noteId);

        if (note) {
            const $wrapper = $('<div class="include-note-wrapper">');

            const $link = await linkService.createLink(note.noteId, {
                showTooltip: false
            });

            $wrapper.empty().append(
                $('<h4 class="include-note-title">')
                    .append($link)
            );

            const {$renderedContent, type} = await contentRenderer.getRenderedContent(note);

            $wrapper.append(
                $(`<div class="include-note-content type-${type}">`)
                    .append($renderedContent)
            );

            $el.empty().append($wrapper);
        }
    }

    async loadReferenceLinkTitle($el, href = null) {
        await linkService.loadReferenceLinkTitle($el, href);
    }

    refreshIncludedNote($container, noteId) {
        if ($container) {
            $container.find(`section[data-note-id="${noteId}"]`).each((_, el) => {
                this.loadIncludedNote(noteId, $(el));
            });
        }
    }
}
