import NoteContextAwareWidget from "./../note_context_aware_widget.js";
import server from "../../services/server.js";
import SpacedUpdate from "../../services/spaced_update.js";

const TPL = `
<div class="swimlane-details">
<style>
  .swimlane-details {
    display: grid;
    grid-template-columns: 10em 150px;
    grid-template-rows: 45px 45px 45px;
    font-family: var(--detail-font-family);
    align-items: center
  }

  .swimlane-details select {
    text-align-last: center;
    padding: 0;
    height: 40px;
  }

  .swimlane-details input {
    text-align-last: center;
    padding: 0;
    height: 40px;
  }

</style>
<h4>Default state</h4>
<select class="swimlane-visibility-dropdown">
  <option>Expanded</option>
  <option>Collapsed</option>
</select>
<h4>Index</h4>
<select class="swimlane-index-dropdown"></select>
<h4>Capacity</h4>
<input min="0" type="number" placeholder="Not set" class="swimlane-capacity-input" />
</div>
`;

export default class SwimlaneTypeWidget extends NoteContextAwareWidget {
    static getType() { return "swimlane"; }

    isEnabled() {
        return super.isEnabled()
            && this.noteContext && this.noteContext.note && (this.noteContext.note.type == "swimlane");
    }

    doRender() {
        this.$widget = $(TPL);

        const index = this.$widget.find(".swimlane-index-dropdown");
        
        const input = this.$widget.find(".swimlane-capacity-input");
        const visibility = this.$widget.find(".swimlane-visibility-dropdown");

        index.on('change', () => {});
        input.on('change', () => {});
        visibility.on('change', {});
        super.doRender();
    }    

    getAttribute(note, attrName) {
        const attrs = (async () => await server.get(`notes/${note.noteId}/attributes`))();
        for(const i in attrs) {
            const attr = attrs[i];
            if (attr.type === 'swimlaneprop' && attr.name === attrName) {
                return {found: true, attr: attr};
            }
        }
        return {found:false};
    }

    refreshWithNote(note) {

        if (note.type !== "swimlane") {
            return;
        }

        const index_dropdown = this.$widget.find(".swimlane-index-dropdown");
        const input = this.$widget.find(".swimlane-capacity-input");
        const visibility_dropdown = this.$widget.find(".swimlane-visibility-dropdown");
        this.$swimlaneId = 0;
        input.val('');
        index_dropdown.val('0');
        visibility_dropdown.val('Expanded');
        if (note === null || note.type !== 'swimlane') {
            return;
        }

        this.$swimlaneId = note.noteId;
        let res = '';
        res = this.getAttribute(note, 'maxchildren');
        if (!res['found']) {
            
        }
        const state = this.getAttribute(note, 'state');
        const index = this.getAttribute(note, 'index');
    }
}