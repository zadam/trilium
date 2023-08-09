import linkService from "../../services/link.js";
import server from "../../services/server.js";
import froca from "../../services/froca.js";
import NoteContextAwareWidget from "../note_context_aware_widget.js";
import options from "../../services/options.js";

const TPL = `
<div class="edited-notes-widget">
    <style>
        .edited-notes-widget {
            padding: 12px;
            max-height: 200px;
            width: 100%;
            overflow: auto;
        }
    </style>
    
    <div class="no-edited-notes-found">No edited notes on this day yet ...</div>
    
    <div class="edited-notes-list"></div>
</div>
`;

export default class EditedNotesWidget extends NoteContextAwareWidget {
    get name() {
        return "editedNotes";
    }

    isEnabled() {
        return super.isEnabled()
            && this.note.hasOwnedLabel("dateNote");
    }

    getTitle() {
        return {
            show: this.isEnabled(),
            // promoted attributes have priority over edited notes
            activate:
                (this.note.getPromotedDefinitionAttributes().length === 0 || !options.is('promotedAttributesOpenInRibbon'))
                && options.is('editedNotesOpenInRibbon'),
            title: 'Edited Notes',
            icon: 'bx bx-calendar-edit'
        };
    }

    async doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$list = this.$widget.find('.edited-notes-list');
        this.$noneFound = this.$widget.find('.no-edited-notes-found');
    }

    async refreshWithNote(note) {
        let editedNotes = await server.get(`edited-notes/${note.getLabelValue("dateNote")}`);

        editedNotes = editedNotes.filter(n => n.noteId !== note.noteId);

        this.$list.empty();
        this.$noneFound.hide();

        if (editedNotes.length === 0) {
            this.$noneFound.show();
            return;
        }

        const noteIds = editedNotes.flatMap(n => n.noteId);

        await froca.getNotes(noteIds, true); // preload all at once

        for (let i = 0; i < editedNotes.length; i++) {
            const editedNote = editedNotes[i];
            const $item = $('<span class="edited-note-line">');

            if (editedNote.isDeleted) {
                const title = `${editedNote.title} (deleted)`;
                $item.append(
                    $("<i>")
                        .text(title)
                        .attr("title", title)
                );
            }
            else {
                $item.append(editedNote.notePath
                    ? await linkService.createLink(editedNote.notePath.join("/"), {showNotePath: true})
                    : $("<span>").text(editedNote.title));
            }

            if (i < editedNotes.length - 1) {
                $item.append(", ");
            }

            this.$list.append($item);
        }
    }
}
