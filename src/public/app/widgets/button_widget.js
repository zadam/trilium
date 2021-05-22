import BasicWidget from "./basic_widget.js";

const TPL = `
<span class="button-widget" 
      data-toggle="tooltip"
      data-placement="right"
      title="">
    <span class="bx"></span>
</span>
`;

export default class ButtonWidget extends BasicWidget {
    constructor() {
        super();

        this.settings = {};
    }

    doRender() {
        this.$widget = $(TPL);
        this.overflowing();

        this.$widget.on("click", () => this.triggerCommand(this.settings.command));

        this.$widget.tooltip({
            html: true,
            title: () => this.settings.title
        });

        super.doRender();
    }

    refreshIcon() {
        this.$widget.attr("title", this.settings.title);
        this.$widget.find("span.bx")
            .removeClass()
            .addClass("bx")
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

    command(command) {
        this.settings.command = command;
        return this;
    }
}
