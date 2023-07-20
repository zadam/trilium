import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section">
    <h4>Open Note In</h4>
    <select class="open-note-in form-control">
        <option value="curtab">Current Tab</option>
        <option value="newtab">New Tab</option>
    </select>
</div>`;

export default class OpenNoteInOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$body = $("body");
        this.$openNoteIn = this.$widget.find(".open-note-in");
        this.$openNoteIn.on('change', () => {
            const newopenNoteIn = this.$openNoteIn.val();

            this.updateOption('openNoteIn', newopenNoteIn);
        });
    }

    async optionsLoaded(options) {
        this.$openNoteIn.val(options.openNoteIn);
    }
}
