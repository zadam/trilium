import CollapsibleWidget from "../collapsible_widget.js";
import linkService from "../../services/link.js";
import server from "../../services/server.js";
import treeCache from "../../services/tree_cache.js";

const TPL = `
<div>
    <style>
        .similar-notes-content a {
            display: inline-block;
            border: 1px dotted var(--main-border-color);
            border-radius: 20px;
            background-color: var(--accented-background-color);
            padding: 0 10px 0 10px;
            margin: 3px;
            max-width: 10em;
            text-overflow: ellipsis;
            white-space: nowrap;
            overflow: hidden;
        }
    </style>

    <div class="similar-notes-content"></div>
</div>
`;

export default class SimilarNotesWidget extends CollapsibleWidget {
    get widgetTitle() { return "Similar notes"; }

    async doRenderBody() {
        this.$body.html(TPL);

        this.$similarNotesContent = this.$body.find(".similar-notes-content");
    }

    get help() {
        return {
            title: "This list contains notes which might be similar to the current note based on textual similarity of note title."
        };
    }

    noteSwitched() {
        const noteId = this.noteId;

        this.$similarNotesContent.empty();

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
            this.$similarNotesContent.text("No similar notes found ...");
            return;
        }

        const noteIds = similarNotes.flatMap(note => note.notePath);

        await treeCache.getNotes(noteIds, true); // preload all at once

        const $list = $('<div>');

        for (const similarNote of similarNotes) {
            const note = await treeCache.getNote(similarNote.noteId, true);

            if (!note) {
                continue;
            }

            const $item = (await linkService.createNoteLink(similarNote.notePath.join("/")))
                .css("font-size", 24 * similarNote.coeff);

            $list.append($item);
        }

        this.$similarNotesContent.empty().append($list);
    }

    entitiesReloadedEvent({loadResults}) {
        if (this.note && this.title !== this.note.title) {
            this.rendered = false;

            this.refresh();
        }
    }
}
