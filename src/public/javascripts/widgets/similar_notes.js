import StandardWidget from "./standard_widget.js";
import linkService from "../services/link.js";
import server from "../services/server.js";
import treeCache from "../services/tree_cache.js";

class SimilarNotesWidget extends StandardWidget {
    getWidgetTitle() { return "Similar notes"; }

    getMaxHeight() { return "200px"; }

    async doRenderBody() {
        const similarNoteIds = await server.get('similar_notes/' + this.ctx.note.noteId);

        console.log(similarNoteIds);

        if (similarNoteIds.length === 0) {
            this.$body.text("No similar notes found ...");
            return;
        }

        await treeCache.getNotes(similarNoteIds); // preload all at once

        const $list = $("<ul>");

        for (const similarNoteId of similarNoteIds) {
            const $item = $("<li>")
                .append(await linkService.createNoteLink(similarNoteId));

            $list.append($item);
        }

        this.$body.empty().append($list);
    }
}

export default SimilarNotesWidget;