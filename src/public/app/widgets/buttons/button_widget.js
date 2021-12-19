import NoteContextAwareWidget from "../note_context_aware_widget.js";
import keyboardActionsService from "../../services/keyboard_actions.js";

const TPL = `<span class="button-widget icon-action bx"
      data-toggle="tooltip"
      title=""></span>`;

let actions;

keyboardActionsService.getActions().then(as => actions = as);

export default class ButtonWidget extends NoteContextAwareWidget {
    isEnabled() {
        return true;
    }

    constructor() {
        super();

        this.settings = {
            titlePlacement: 'right'
        };
    }

    doRender() {
        this.$widget = $(TPL);

        if (this.settings.onClick) {
            this.$widget.on("click", e => {
                this.$widget.tooltip("hide");

                this.settings.onClick(this, e);
            });
        } else {
            this.$widget.on("click", () => {
                this.$widget.tooltip("hide");

                this.triggerCommand(this.settings.command);
            });
        }

        this.$widget.attr("data-placement", this.settings.titlePlacement);

        this.$widget.tooltip({
            html: true,
            title: () => {
                const title = typeof this.settings.title === "function"
                    ? this.settings.title()
                    : this.settings.title;

                const action = actions.find(act => act.actionName === this.settings.command);

                if (action && action.effectiveShortcuts.length > 0) {
                    return `${title} (${action.effectiveShortcuts.join(", ")})`;
                }
                else {
                    return title;
                }
            },
            trigger: "hover"
        });

        super.doRender();
    }

    refreshIcon() {
        for (const className of this.$widget[0].classList) {
            if (className.startsWith("bx-")) {
                this.$widget.removeClass(className);
            }
        }

        this.$widget
            .attr("title", this.settings.title)
            .addClass(this.settings.icon);
    }

    initialRenderCompleteEvent() {
        this.refreshIcon();
    }

    icon(icon) {
        this.settings.icon = icon;
        return this;
    }

    title(title) {
        this.settings.title = title;
        return this;
    }

    titlePlacement(placement) {
        this.settings.titlePlacement = placement;
        return this;
    }

    command(command) {
        this.settings.command = command;
        return this;
    }

    onClick(handler) {
        this.settings.onClick = handler;
        return this;
    }
}
