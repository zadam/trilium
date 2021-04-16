import CollapsibleWidget from "../collapsible_widget.js";
import linkService from "../../services/link.js";
import server from "../../services/server.js";
import froca from "../../services/tree_cache.js";

const TPL = `
<div class="edited-notes-widget">
    <style>    
        .edited-notes-widget .edited-note-line {
            white-space: nowrap; 
            overflow-x: hidden; 
            text-overflow: ellipsis;
        }
    </style>
    
    <div class="no-edited-notes-found">No edited notes on this day yet ...</div>
    
    <div class="edited-notes-list"></div>
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
        this.$list = this.$body.find('.edited-notes-list');
        this.$noneFound = this.$body.find('.no-edited-notes-found');
    }

    async refreshWithNote(note) {
        let editedNotes = await server.get('edited-notes/' + note.getLabelValue("dateNote"));

        editedNotes = editedNotes.filter(n => n.noteId !== note.noteId);

        this.$list.empty();
        this.$noneFound.hide();

        if (editedNotes.length === 0) {
            this.$noneFound.show();
            return;
        }

        const noteIds = editedNotes.flatMap(n => n.noteId);

        await froca.getNotes(noteIds, true); // preload all at once

        for (const editedNote of editedNotes) {
            const $item = $('<div class="edited-note-line">');

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

            this.$list.append($item);
        }
    }
}
