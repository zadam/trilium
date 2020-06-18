import TypeWidget from "./type_widget.js";
import appContext from "../../services/app_context.js";
import treeCache from "../../services/tree_cache.js";
import linkService from "../../services/link.js";
import noteContentRenderer from "../../services/note_content_renderer.js";

export default class AbstractTextTypeWidget extends TypeWidget {
    doRender() {
        this.$widget.on("dblclick", "img", e => {
            const $img = $(e.target);
            const src = $img.prop("src");

            const match = src.match(/\/api\/images\/([A-Za-z0-9]+)\//);

            if (match) {
                const noteId = match[1];

                appContext.tabManager.getActiveTabContext().setNote(noteId);
            }
            else {
                window.open(src, '_blank');
            }
        });
    }

    async loadIncludedNote(noteId, $el) {
        const note = await treeCache.getNote(noteId);

        if (note) {
            const $link = await linkService.createNoteLink(note.noteId, {
                showTooltip: false
            });

            $el.empty().append(
                $('<h4 class="include-note-title">')
                    .append($link)
            );

            const {renderedContent} = await noteContentRenderer.getRenderedContent(note);

            $el.append(
                $('<div class="include-note-content">')
                    .append(renderedContent)
            );
        }
    }

    async loadReferenceLinkTitle(noteId, $el) {
        const note = await treeCache.getNote(noteId, true);

        let title;

        if (!note) {
            title = '[missing]';
        }
        else if (!note.isDeleted) {
            title = note.title;
        }
        else {
            title = note.isErased ? '[erased]' : `${note.title} (deleted)`;
        }

        $el.text(title);
    }

    refreshIncludedNote($container, noteId) {
        if ($container) {
            $container.find(`section[data-note-id="${noteId}"]`).each((_, el) => {
                this.loadIncludedNote(noteId, $(el));
            });
        }
    }
}
