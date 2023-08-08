import AbstractSearchOption from "./abstract_search_option.js";
import noteAutocompleteService from "../../services/note_autocomplete.js";

const TPL = `
<tr>
    <td class="title-column">
        Search script: 
    </td>
    <td>
        <div class="input-group">
            <input class="search-script form-control" placeholder="search for note by its name">
        </div>
    </td>
        <td class="button-column">
        <div class="dropdown help-dropdown">
          <span class="bx bx-help-circle icon-action" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"></span>
          <div class="dropdown-menu dropdown-menu-right p-4">
            <p>Search script allows to define search results by running a script. This provides maximal flexibility when standard search doesn't suffice.</p>
            
            <p>Search script must be of type "code" and subtype "JavaScript backend". The script receives  needs to return an array of noteIds or notes.</p>
            
            <p>See this example:</p>
            
            <pre>
// 1. prefiltering using standard search
const candidateNotes = api.searchForNotes("#journal"); 

// 2. applying custom search criteria
const matchedNotes = candidateNotes
    .filter(note => note.title.match(/[0-9]{1,2}\. ?[0-9]{1,2}\. ?[0-9]{4}\/));

return matchedNotes;</pre>

            <p>Note that search script and search string can't be combined with each other.</p>
          </div>
        </div>
        
        <span class="bx bx-x icon-action search-option-del"></span>
    </td>
</tr>`;

export default class SearchScript extends AbstractSearchOption {
    static get optionName() { return "searchScript" };
    static get attributeType() { return "relation" };

    static async create(noteId) {
        await AbstractSearchOption.setAttribute(noteId, 'relation', 'searchScript', 'root');
    }

    doRender() {
        const $option = $(TPL);
        const $searchScript = $option.find('.search-script');
        noteAutocompleteService.initNoteAutocomplete($searchScript, {allowCreatingNotes: true});

        $searchScript.on('autocomplete:closed', async () => {
            const searchScriptNoteId = $searchScript.getSelectedNoteId();

            if (searchScriptNoteId) {
                await this.setAttribute('relation', 'searchScript', searchScriptNoteId);
            }
        });

        const searchScriptNoteId = this.note.getRelationValue('searchScript');

        if (searchScriptNoteId !== 'root') {
            $searchScript.setNote(searchScriptNoteId);
        }

        return $option;
    }
}
