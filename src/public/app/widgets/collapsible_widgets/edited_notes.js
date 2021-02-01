import CollapsibleWidget from "../collapsible_widget.js";
import linkService from "../../services/link.js";
import server from "../../services/server.js";
import treeCache from "../../services/tree_cache.js";

const TPL = `
<div class="edited-notes-widget">
    <style>
        .edited-notes-widget ul {
            padding-left: 10px !important;
        }
    
        .edited-notes-widget ul li {
            white-space: nowrap; 
            list-style-position:inside; 
            overflow-x: hidden; 
            text-overflow: ellipsis;
        }
    </style>
</div>
`;

export default class EditedNotesWidget extends CollapsibleWidget {
    get widgetTitle() { return "Edited notes on this day"; }

    get help() {
        return {
            title: "This contains a list of notes created or updated on this day."
        };
    }

    isEnabled() {
        return super.isEnabled()
            && this.note.hasOwnedLabel("dateNote");
    }

    async doRenderBody() {
        this.$body.html(TPL);
        this.$editedNotes = this.$body.find('.edited-notes-widget');
    }

    async refreshWithNote(note) {
        // remember which title was when we found the similar notes
        this.title = note.title;
        let editedNotes = await server.get('edited-notes/' + note.getLabelValue("dateNote"));

        editedNotes = editedNotes.filter(n => n.noteId !== note.noteId);

        if (editedNotes.length === 0) {
            this.$body.text("No edited notes on this day yet ...");
            return;
        }

        const noteIds = editedNotes.flatMap(n => n.noteId);

        await treeCache.getNotes(noteIds, true); // preload all at once

        const $list = $('<ul>');

        for (const editedNote of editedNotes) {
            const $item = $('<li>');

            if (editedNote.isDeleted) {
                const title = editedNote.title + " (deleted)";
                $item.append(
                    $("<i>")
                        .text(title)
                        .attr("title", title)
                );
            }
            else {
                $item.append(editedNote.notePath ? await linkService.createNoteLink(editedNote.notePath.join("/"), {showNotePath: true}) : editedNote.title);
            }

            $list.append($item);
        }

        this.$editedNotes.empty().append($list);
    }
}
