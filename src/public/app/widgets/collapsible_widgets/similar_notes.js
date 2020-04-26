import CollapsibleWidget from "../collapsible_widget.js";
import linkService from "../../services/link.js";
import server from "../../services/server.js";
import treeCache from "../../services/tree_cache.js";

export default class SimilarNotesWidget extends CollapsibleWidget {
    get widgetTitle() { return "Similar notes"; }

    get help() {
        return {
            title: "This list contains notes which might be similar to the current note based on textual similarity of note title."
        };
    }

    noteSwitched() {
        const noteId = this.noteId;

        this.$body.empty();

        // avoid executing this expensive operation multiple times when just going through notes (with keyboard especially)
        // until the users settles on a note
        setTimeout(() => {
            if (this.noteId === noteId) {
                this.refresh();
            }
        }, 1000);
    }

    async refreshWithNote(note) {
        // remember which title was when we found the similar notes
        this.title = note.title;

        const similarNotes = await server.get('similar-notes/' + this.noteId);

        if (similarNotes.length === 0) {
            this.$body.text("No similar notes found ...");
            return;
        }

        const noteIds = similarNotes.flatMap(note => note.notePath);

        await treeCache.getNotes(noteIds, true); // preload all at once

        const $list = $('<ul>');

        for (const similarNote of similarNotes) {
            const note = await treeCache.getNote(similarNote.noteId, true);

            if (!note) {
                continue;
            }

            const $item = $("<li>")
                .append(await linkService.createNoteLink(similarNote.notePath.join("/"), {showNotePath: true}));

            $list.append($item);
        }

        this.$body.empty().append($list);
    }

    entitiesReloadedEvent({loadResults}) {
        if (this.note && this.title !== this.note.title) {
            this.rendered = false;

            this.refresh();
        }
    }
}