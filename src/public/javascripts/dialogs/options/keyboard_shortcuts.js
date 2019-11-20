import server from "../../services/server.js";
import optionsService from "../../services/options.js";

const TPL = `
<h4>Keyboard shortcuts</h4>

<div style="overflow: auto; height: 500px;">
    <table id="keyboard-shortcut-table" cellpadding="10">
    <thead>
        <tr>
            <th>Action name</th>
            <th>Shortcuts</th>
            <th>Default shortcuts</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody></tbody>
    </table>
</div>

<div style="display: flex; justify-content: space-between">
    <button class="btn btn-primary">Reload app to apply changes</button>
    
    <button class="btn">Set all shortcuts to the default</button>
</div>
`;

export default class KeyboardShortcutsOptions {
    constructor() {
        $("#options-keyboard-shortcuts").html(TPL);

        const $table = $("#keyboard-shortcut-table tbody");

        server.get('keyboard-actions').then(actions => {
            for (const action of actions) {
                const $tr = $("<tr>")
                    .append($("<td>").text(action.actionName))
                    .append($("<td>").append(
                        $(`<input type="text" class="form-control">`).val(action.effectiveShortcuts.join(", ")))
                    )
                    .append($("<td>").text(action.defaultShortcuts.join(", ")))
                    .append($("<td>").text(action.description));

                $table.append($tr);
            }
        });
    }

    async save() {
        const enabledMimeTypes = [];

        this.$mimeTypes.find("input:checked").each(
            (i, el) => enabledMimeTypes.push($(el).attr("data-mime-type")));

        const opts = { codeNotesMimeTypes: JSON.stringify(enabledMimeTypes) };

        await server.put('options', opts);

        await optionsService.reloadOptions();
    }
}