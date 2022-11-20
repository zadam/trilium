import mimeTypesService from "../../../services/mime_types.js";
import options from "../../../services/options.js";
import server from "../../../services/server.js";
import toastService from "../../../services/toast.js";
import OptionsTab from "./options_tab.js";

const TPL = `
<div class="options-section">
    <h4>Use vim keybindings in code notes (no ex mode)</h4>
    <div class="custom-control custom-checkbox">
        <input type="checkbox" class="custom-control-input" id="vim-keymap-enabled">
        <label class="custom-control-label" for="vim-keymap-enabled">Enable Vim Keybindings</label>
    </div>
</div>

<div class="options-section">
    <h4>Wrap lines in code notes</h4>
    <div class="custom-control custom-checkbox">
        <input type="checkbox" class="custom-control-input" id="line-wrap-enabled">
        <label class="custom-control-label" for="line-wrap-enabled">Enable Line Wrap (change might need a frontend reload to take effect)</label>
    </div>
</div>

<div class="options-section">
    <h4>Automatic readonly size</h4>

    <p>Automatic readonly note size is the size after which notes will be displayed in a readonly mode (for performance reasons).</p>

    <div class="form-group">
        <label for="auto-readonly-size-code">Automatic readonly size (code notes)</label>
        <input class="form-control" id="auto-readonly-size-code" type="number" min="0">
    </div>
</div>

<div class="options-section">
    <h4>Available MIME types in the dropdown</h4>
    
    <ul id="options-mime-types" style="max-height: 500px; overflow: auto; list-style-type: none;"></ul>
</div>`;

export default class CodeNotesOptions extends OptionsTab {
    get tabTitle() { return "Code notes" }

    lazyRender() {
        this.$widget = $(TPL);

        this.$vimKeymapEnabled = this.$widget.find("#vim-keymap-enabled");
        this.$vimKeymapEnabled.on('change', () =>
            this.updateCheckboxOption('vimKeymapEnabled', this.$vimKeymapEnabled));

        this.$codeLineWrapEnabled = this.$widget.find("#line-wrap-enabled");
        this.$codeLineWrapEnabled.on('change', () =>
            this.updateCheckboxOption('codeLineWrapEnabled', this.$codeLineWrapEnabled));

        this.$mimeTypes = this.$widget.find("#options-mime-types");

        this.$autoReadonlySizeCode = this.$widget.find("#auto-readonly-size-code");
        this.$autoReadonlySizeCode.on('change', () =>
            this.updateOption('autoReadonlySizeCode', this.$autoReadonlySizeCode.val()));
    }

    async optionsLoaded(options) {
        this.$mimeTypes.empty();
        this.setCheckboxState(this.$vimKeymapEnabled, options.vimKeymapEnabled);
        this.setCheckboxState(this.$codeLineWrapEnabled, options.codeLineWrapEnabled);
        this.$autoReadonlySizeCode.val(options.autoReadonlySizeCode);

        let idCtr = 1;

        for (const mimeType of await mimeTypesService.getMimeTypes()) {
            const id = "code-mime-type-" + (idCtr++);

            this.$mimeTypes.append($("<li>")
                .append($('<input type="checkbox">')
                    .attr("id", id)
                    .attr("data-mime-type", mimeType.mime)
                    .prop("checked", mimeType.enabled))
                    .on('change', () => this.save())
                .append(" &nbsp; ")
                .append($('<label>')
                    .attr("for", id)
                    .text(mimeType.title))
            );
        }
    }

    async save() {
        const enabledMimeTypes = [];

        this.$mimeTypes.find("input:checked").each(
            (i, el) => enabledMimeTypes.push(this.$widget.find(el).attr("data-mime-type")));

        await this.updateOption('codeNotesMimeTypes', JSON.stringify(enabledMimeTypes));

        mimeTypesService.loadMimeTypes();
    }
}
