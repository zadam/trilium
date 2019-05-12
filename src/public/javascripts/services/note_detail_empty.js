import noteAutocompleteService from '../services/note_autocomplete.js';
import treeService from "./tree.js";

class NoteDetailEmpty {
    /**
     * @param {TabContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.$component = ctx.$tabContent.find('.note-detail-empty');
        this.$autoComplete = ctx.$tabContent.find(".note-autocomplete");
    }

    render() {
        this.$component.show();
        this.ctx.$noteTitleRow.hide();

        noteAutocompleteService.initNoteAutocomplete(this.$autoComplete, { hideGoToSelectedNoteButton: true })
            .on('autocomplete:selected', function(event, suggestion, dataset) {
                if (!suggestion.path) {
                    return false;
                }

                treeService.activateNote(suggestion.path);
            });

        noteAutocompleteService.showRecentNotes(this.$autoComplete);
        this.$autoComplete.focus();
    }

    getContent() {}

    focus() {}

    onNoteChange() {}

    cleanup() {}

    scrollToTop() {}
}

export default NoteDetailEmpty;