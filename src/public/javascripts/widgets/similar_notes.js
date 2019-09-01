import StandardWidget from "./standard_widget.js";
import linkService from "../services/link.js";
import server from "../services/server.js";
import treeCache from "../services/tree_cache.js";
import treeUtils from "../services/tree_utils.js";

class SimilarNotesWidget extends StandardWidget {
    getWidgetTitle() { return "Similar notes"; }

    getMaxHeight() { return "200px"; }

    async doRenderBody() {
        const similarNotes = await server.get('similar_notes/' + this.ctx.note.noteId);

        if (similarNotes.length === 0) {
            this.$body.text("No similar notes found ...");
            return;
        }

        await treeCache.getNotes(similarNotes.map(note => note.noteId)); // preload all at once

        const $list = $('<ul style="padding-left: 20px;">');

        for (const similarNote of similarNotes) {
            const $item = $("<li>")
                .append(await linkService.createNoteLink(similarNote.notePath.join("/")));

            similarNote.notePath.pop(); // remove last noteId since it's already in the link

            if (similarNote.notePath.length > 0) {
                $item.append($("<small>").text(" (" + await treeUtils.getNotePathTitle(similarNote.notePath.join("/")) + ")"));
            }

            $list.append($item);
        }

        this.$body.empty().append($list);
    }
}

export default SimilarNotesWidget;