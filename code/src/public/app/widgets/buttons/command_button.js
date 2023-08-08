import keyboardActionsService from "../../services/keyboard_actions.js";
import AbstractButtonWidget from "./abstract_button.js";

let actions;

keyboardActionsService.getActions().then(as => actions = as);

export default class CommandButtonWidget extends AbstractButtonWidget {
    doRender() {
        super.doRender();

        if (this.settings.command) {
            this.$widget.on("click", () => {
                this.$widget.tooltip("hide");

                this.triggerCommand(this._command);
            });
        } else {
            console.warn(`Button widget '${this.componentId}' has no defined command`, this.settings);
        }
    }

    getTitle() {
        const title = super.getTitle();

        const action = actions.find(act => act.actionName === this._command);

        if (action && action.effectiveShortcuts.length > 0) {
            return `${title} (${action.effectiveShortcuts.join(", ")})`;
        } else {
            return title;
        }
    }

    onClick(handler) {
        this.settings.onClick = handler;
        return this;
    }

    /**
     * @param {function|string} command
     * @returns {this}
     */
    command(command) {
        this.settings.command = command;
        return this;
    }

    get _command() {
        return typeof this.settings.command === "function"
            ? this.settings.command()
            : this.settings.command;
    }
}
