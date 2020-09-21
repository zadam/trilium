import noteAutocompleteService from '../../services/note_autocomplete.js';
import TypeWidget from "./type_widget.js";
import appContext from "../../services/app_context.js";

const TPL = `
<div class="note-detail-empty note-detail-printable">
    <div class="form-group">
        <label>Open a note by typing the note's title into the input below or choose a note in the tree.</label>
        <div class="input-group">
            <input class="form-control note-autocomplete" placeholder="search for a note by its name">
        </div>
    </div>
</div>`;

export default class EmptyTypeWidget extends TypeWidget {
    static getType() { return "empty"; }

    doRender() {
        // FIXME: this might be optimized - cleaned up after use since it's always used only for new tab

        this.$widget = $(TPL);
        this.$autoComplete = this.$widget.find(".note-autocomplete");

        noteAutocompleteService.initNoteAutocomplete(this.$autoComplete, { hideGoToSelectedNoteButton: true })
            .on('autocomplete:noteselected', function(event, suggestion, dataset) {
                if (!suggestion.notePath) {
                    return false;
                }

                appContext.tabManager.getActiveTabContext().setNote(suggestion.notePath);
            });

        noteAutocompleteService.showRecentNotes(this.$autoComplete);
    }

    doRefresh(note) {
        this.$autoComplete.trigger('focus');
    }
}
