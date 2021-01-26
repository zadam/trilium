import AbstractSearchOption from "./abstract_search_option.js";
import noteAutocompleteService from "../../services/note_autocomplete.js";

const TPL = `
<tr>
    <td class="title-column" title="Matched notes must be within subtree of given note.">
        Ancestor: 
    </td>
    <td>
        <div class="input-group">
            <input class="ancestor form-control" placeholder="search for note by its name">
        </div>
    </td>
    <td class="button-column">
        <span class="bx bx-x icon-action search-option-del"></span>
    </td>
</tr>`;

export default class Ancestor extends AbstractSearchOption {
    static get optionName() { return "ancestor" };
    static get attributeType() { return "relation" };

    static async create(noteId) {
        await AbstractSearchOption.setAttribute(noteId, 'relation', 'ancestor', 'root');
    }

    doRender() {
        const $option = $(TPL);
        const $ancestor = $option.find('.ancestor');
        noteAutocompleteService.initNoteAutocomplete($ancestor);

        $ancestor.on('autocomplete:closed', async () => {
            const ancestorNoteId = $ancestor.getSelectedNoteId();

            if (ancestorNoteId) {
                await this.setAttribute('relation', 'ancestor', ancestorNoteId);
            }
        });

        const ancestorNoteId = this.note.getRelationValue('ancestor');

        if (ancestorNoteId !== 'root') {
            $ancestor.setNote(ancestorNoteId);
        }

        return $option;
    }
}
