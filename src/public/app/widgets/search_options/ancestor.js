import AbstractSearchOption from "./abstract_search_option.js";
import noteAutocompleteService from "../../services/note_autocomplete.js";

const TPL = `
<tr>
    <td colspan="2">
        <div style="display: flex; align-items: center;">
            <div style="margin-right: 10px">Ancestor:</div> 
            <div class="input-group" style="flex-shrink: 2">
                <input class="ancestor form-control" placeholder="search for note by its name">
            </div>
            
            <div style="margin-left: 10px; margin-right: 10px">depth:</div>
            
            <select name="depth" class="form-control d-inline ancestor-depth" style="flex-shrink: 3">
                <option value="">doesn't matter</option>
                <option value="eq1">is exactly 1 (direct children)</option>
                <option value="eq2">is exactly 2</option>
                <option value="eq3">is exactly 3</option>
                <option value="eq4">is exactly 4</option>
                <option value="eq5">is exactly 5</option>
                <option value="eq6">is exactly 6</option>
                <option value="eq7">is exactly 7</option>
                <option value="eq8">is exactly 8</option>
                <option value="eq9">is exactly 9</option>
                <option value="gt0">is greater than 0</option>
                <option value="gt1">is greater than 1</option>
                <option value="gt2">is greater than 2</option>
                <option value="gt3">is greater than 3</option>
                <option value="gt4">is greater than 4</option>
                <option value="gt5">is greater than 5</option>
                <option value="gt6">is greater than 6</option>
                <option value="gt7">is greater than 7</option>
                <option value="gt8">is greater than 8</option>
                <option value="gt9">is greater than 9</option>
                <option value="lt2">is less than 2</option>
                <option value="lt3">is less than 3</option>
                <option value="lt4">is less than 4</option>
                <option value="lt5">is less than 5</option>
                <option value="lt6">is less than 6</option>
                <option value="lt7">is less than 7</option>
                <option value="lt8">is less than 8</option>
                <option value="lt9">is less than 9</option>
            </select>
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
        const $ancestorDepth = $option.find('.ancestor-depth');
        noteAutocompleteService.initNoteAutocomplete($ancestor);

        $ancestor.on('autocomplete:closed', async () => {
            const ancestorNoteId = $ancestor.getSelectedNoteId();

            if (ancestorNoteId) {
                await this.setAttribute('relation', 'ancestor', ancestorNoteId);
            }
        });

        $ancestorDepth.on('change', async () => {
            const ancestorDepth = $ancestorDepth.val();

            if (ancestorDepth) {
                await this.setAttribute('label', 'ancestorDepth', ancestorDepth);
            }
            else {
                await this.deleteAttribute('label', 'ancestorDepth');
            }
        });

        const ancestorNoteId = this.note.getRelationValue('ancestor');

        if (ancestorNoteId !== 'root') {
            $ancestor.setNote(ancestorNoteId);
        }

        const ancestorDepth = this.note.getLabelValue('ancestorDepth');

        if (ancestorDepth) {
            $ancestorDepth.val(ancestorDepth);
        }

        return $option;
    }

    async deleteOption() {
        await this.deleteAttribute('label', 'ancestorDepth');

        await super.deleteOption();
    }
}
