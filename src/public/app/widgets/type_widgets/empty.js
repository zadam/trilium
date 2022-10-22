import noteAutocompleteService from '../../services/note_autocomplete.js';
import TypeWidget from "./type_widget.js";
import appContext from "../../services/app_context.js";
import searchService from "../../services/search.js";

const TPL = `
<div class="note-detail-empty note-detail-printable">
    <style>
        .workspace-notes {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: space-evenly;
        }
        
        .workspace-notes .workspace-note {
            width: 130px;
            text-align: center;
            margin: 10px;
            padding; 10px;
            border: 1px transparent solid;
        }
        
        .workspace-notes .workspace-note:hover {
            cursor: pointer;
            border: 1px solid var(--main-border-color);
        }
        
        .workspace-icon {
            text-align: center;
            font-size: 500%;
        }
    </style>

    <div class="form-group">
        <label>Open a note by typing the note's title into the input below or choose a note in the tree.</label>
        <div class="input-group">
            <input class="form-control note-autocomplete" placeholder="search for a note by its name">
        </div>
    </div>
    
    <div class="workspace-notes"></div>
</div>`;

export default class EmptyTypeWidget extends TypeWidget {
    static getType() { return "empty"; }

    doRender() {
        // FIXME: this might be optimized - cleaned up after use since it's always used only for new tab

        this.$widget = $(TPL);
        this.$autoComplete = this.$widget.find(".note-autocomplete");

        noteAutocompleteService.initNoteAutocomplete(this.$autoComplete, {
            hideGoToSelectedNoteButton: true,
            allowCreatingNotes: true
        })
            .on('autocomplete:noteselected', function(event, suggestion, dataset) {
                if (!suggestion.notePath) {
                    return false;
                }

                appContext.tabManager.getActiveContext().setNote(suggestion.notePath);
            });

        this.$workspaceNotes = this.$widget.find('.workspace-notes');

        super.doRender();
    }

    async doRefresh(note) {
        const workspaceNotes = await searchService.searchForNotes('#workspace #!template');

        this.$workspaceNotes.empty();

        for (const workspaceNote of workspaceNotes) {
            this.$workspaceNotes.append(
                $('<div class="workspace-note">')
                    .append($("<div>").addClass(workspaceNote.getIcon() + " workspace-icon"))
                    .append($("<div>").text(workspaceNote.title))
                    .attr("title", "Enter workspace " + workspaceNote.title)
                    .on('click', () => this.triggerCommand('hoistNote', {noteId: workspaceNote.noteId}))
            );
        }

        this.$autoComplete
            .trigger('focus')
            .trigger('select');
    }
}
