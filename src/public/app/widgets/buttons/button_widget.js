import NoteContextAwareWidget from "../note_context_aware_widget.js";

const TPL = `<span class="button-widget icon-action bx"
      data-toggle="tooltip"
      title=""></span>`;

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
            this.$widget.on("click", () => this.settings.onClick(this));
        } else {
            this.$widget.on("click", () => this.triggerCommand(this.settings.command));
        }

        this.$widget.attr("data-placement", this.settings.titlePlacement);

        this.$widget.tooltip({
            html: true,
            title: () => this.settings.title,
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
