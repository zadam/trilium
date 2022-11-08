import mimeTypesService from "../../../services/mime_types.js";
import options from "../../../services/options.js";
import server from "../../../services/server.js";
import toastService from "../../../services/toast.js";

const TPL = `
<h4>Use vim keybindings in code notes (no ex mode)</h4>
<div class="custom-control custom-checkbox">
    <input type="checkbox" class="custom-control-input" id="vim-keymap-enabled">
    <label class="custom-control-label" for="vim-keymap-enabled">Enable Vim Keybindings</label>
</div>
<br/>

<h4>Wrap lines in code notes</h4>
<div class="custom-control custom-checkbox">
    <input type="checkbox" class="custom-control-input" id="line-wrap-enabled">
    <label class="custom-control-label" for="line-wrap-enabled">Enable Line Wrap (change might need a frontend reload to take effect)</label>
</div>
<br/>

<h4>Available MIME types in the dropdown</h4>

<ul id="options-mime-types" style="max-height: 500px; overflow: auto; list-style-type: none;"></ul>`;

export default class CodeNotesOptions {
    constructor() {
        $("#options-code-notes").html(TPL);

        this.$vimKeymapEnabled = $("#vim-keymap-enabled");
        this.$vimKeymapEnabled.on('change', () => {
            const opts = { 'vimKeymapEnabled': this.$vimKeymapEnabled.is(":checked") ? "true" : "false" };
            server.put('options', opts).then(() => toastService.showMessage("Options change have been saved."));
            return false;
        });
        this.$codeLineWrapEnabled = $("#line-wrap-enabled");
        this.$codeLineWrapEnabled.on('change', () => {
            const opts = { 'codeLineWrapEnabled': this.$codeLineWrapEnabled.is(":checked") ? "true" : "false" };
            server.put('options', opts).then(() => toastService.showMessage("Options change have been saved."));
            return false;
        });
        this.$mimeTypes = $("#options-mime-types");
    }

    async optionsLoaded(options) {
        this.$mimeTypes.empty();
        this.$vimKeymapEnabled.prop("checked", options['vimKeymapEnabled'] === 'true');
        this.$codeLineWrapEnabled.prop("checked", options['codeLineWrapEnabled'] === 'true');
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
            (i, el) => enabledMimeTypes.push($(el).attr("data-mime-type")));

        await options.save('codeNotesMimeTypes', JSON.stringify(enabledMimeTypes));

        mimeTypesService.loadMimeTypes();
    }
}
