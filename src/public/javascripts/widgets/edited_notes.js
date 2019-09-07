import StandardWidget from "./standard_widget.js";
import linkService from "../services/link.js";
import server from "../services/server.js";
import treeCache from "../services/tree_cache.js";

class EditedNotesWidget extends StandardWidget {
    getWidgetTitle() { return "Edited notes on this day"; }

    getMaxHeight() { return "200px"; }

    async isEnabled() {
        return await super.isEnabled()
            && await this.ctx.note.hasLabel("dateNote");
    }

    async doRenderBody() {
        // remember which title was when we found the similar notes
        this.title = this.ctx.note.title;

        let editedNotes = await server.get('edited-notes/' + await this.ctx.note.getLabelValue("dateNote"));

        editedNotes = editedNotes.filter(note => note.noteId !== this.ctx.note.noteId);

        if (editedNotes.length === 0) {
            this.$body.text("No edited notes on this day yet ...");
            return;
        }

        const noteIds = editedNotes.flatMap(note => note.notePath);

        await treeCache.getNotes(noteIds); // preload all at once

        const $list = $('<ul>');

        for (const editedNote of editedNotes) {
            const note = await treeCache.getNote(editedNote.noteId);

            if (!note) {
                continue;
            }

            const $item = $("<li>")
                .append(editedNote.notePath ? await linkService.createNoteLinkWithPath(editedNote.notePath.join("/")) : editedNote.title);

            $list.append($item);
        }

        this.$body.empty().append($list);
    }
}

export default EditedNotesWidget;