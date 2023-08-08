import server from "../../../services/server.js";
import utils from "../../../services/utils.js";
import dialogService from "../../../services/dialog.js";
import OptionsWidget from "./options_widget.js";

const TPL = `
<div class="options-section shortcuts-options-section">
    <style>
        .shortcuts-options-section {
            display: flex; 
            flex-direction: column; 
            height: 100%;
        }
    
        .shortcuts-table-container {
            overflow: auto; 
            flex-grow: 1; 
            flex-shrink: 1; 
        }    
        
        .shortcuts-options-buttons {
            display: flex; 
            justify-content: space-between;
            margin: 15px 15px 0 15px;
        }
    </style>

    <h4>Keyboard Shortcuts</h4>
    
    <p>
      Multiple shortcuts for the same action can be separated by comma.
      See <a href="https://www.electronjs.org/docs/latest/api/accelerator">Electron documentation</a> for available modifiers and key codes.
    </p>
    
    <div class="form-group">
        <input type="text" class="keyboard-shortcut-filter form-control" placeholder="Type text to filter shortcuts...">
    </div>
    
    <div class="shortcuts-table-container">
        <table class="keyboard-shortcut-table" cellpadding="10">
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
    
    <div class="shortcuts-options-buttons">
        <button class="options-keyboard-shortcuts-reload-app btn btn-primary">Reload app to apply changes</button>
        
        <button class="options-keyboard-shortcuts-set-all-to-default btn">Set all shortcuts to the default</button>
    </div>
</div>`;

let globActions;

export default class KeyboardShortcutsOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$widget.find(".options-keyboard-shortcuts-reload-app").on("click", () => utils.reloadFrontendApp());

        const $table = this.$widget.find(".keyboard-shortcut-table tbody");

        server.get('keyboard-actions').then(actions => {
            globActions = actions;

            for (const action of actions) {
                const $tr = $("<tr>");

                if (action.separator) {
                    $tr.append(
                        $('<td colspan="4">')
                            .attr("style","background-color: var(--accented-background-color); font-weight: bold;")
                            .text(action.separator)
                    )
                }
                else {
                    $tr.append($("<td>").text(action.actionName))
                        .append($("<td>").append(
                            $(`<input type="text" class="form-control">`)
                                .val(action.effectiveShortcuts.join(", "))
                                .attr('data-keyboard-action-name', action.actionName)
                                .attr('data-default-keyboard-shortcuts', action.defaultShortcuts.join(", "))
                            )
                        )
                        .append($("<td>").text(action.defaultShortcuts.join(", ")))
                        .append($("<td>").text(action.description));
                }

                $table.append($tr);
            }
        });

        $table.on('change', 'input.form-control', e => {
            const $input = this.$widget.find(e.target);
            const actionName = $input.attr('data-keyboard-action-name');
            const shortcuts = $input.val()
                              .replace('+,', "+Comma")
                              .split(",")
                              .map(shortcut => shortcut.replace("+Comma", "+,"))
                              .filter(shortcut => !!shortcut);

            const optionName = `keyboardShortcuts${actionName.substr(0, 1).toUpperCase()}${actionName.substr(1)}`;

            this.updateOption(optionName, JSON.stringify(shortcuts));
        });

        this.$widget.find(".options-keyboard-shortcuts-set-all-to-default").on('click', async () => {
            if (!await dialogService.confirm("Do you really want to reset all keyboard shortcuts to the default?")) {
                return;
            }

            $table.find('input.form-control').each((_index, el) => {
                const defaultShortcuts = this.$widget.find(el).attr('data-default-keyboard-shortcuts');

                if (this.$widget.find(el).val() !== defaultShortcuts) {
                    this.$widget.find(el)
                        .val(defaultShortcuts)
                        .trigger('change');
                }
            });
        });

        const $filter = this.$widget.find(".keyboard-shortcut-filter");

        $filter.on('keyup', () => {
            const filter = $filter.val().trim().toLowerCase();

            $table.find("tr").each((i, el) => {
                if (!filter) {
                    this.$widget.find(el).show();
                    return;
                }

                const actionName = this.$widget.find(el).find('input').attr('data-keyboard-action-name');

                if (!actionName) {
                    this.$widget.find(el).hide();
                    return;
                }

                const action = globActions.find(act => act.actionName === actionName);

                if (!action) {
                    this.$widget.find(el).hide();
                    return;
                }

                this.$widget.find(el).toggle(!!( // !! to avoid toggle overloads with different behavior
                    action.actionName.toLowerCase().includes(filter)
                    || action.defaultShortcuts.some(shortcut => shortcut.toLowerCase().includes(filter))
                    || action.effectiveShortcuts.some(shortcut => shortcut.toLowerCase().includes(filter))
                    || (action.description && action.description.toLowerCase().includes(filter))
                ));
            });
        });
    }
}
