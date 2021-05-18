import BasicWidget from "./basic_widget.js";

const TPL = `
<span class="button-widget" 
      title="">
    <span class="bx"></span>
</span>
`;

export default class ButtonWidget extends BasicWidget {
    constructor() {
        super();

        this.options = {};
    }

    doRender() {
        this.$widget = $(TPL);
        this.refreshIcon();
        this.overflowing();

        this.$widget.on("click", () => this.triggerCommand(this.options.command));

        super.doRender();
    }

    refreshIcon() {
        this.$widget.attr("title", this.options.title);
        this.$widget.find("span.bx")
            .removeClass()
            .addClass("bx")
            .addClass(this.options.icon);
    }

    icon(icon) {
        this.options.icon = icon;
        return this;
    }

    title(title) {
        this.options.title = title;
        return this;
    }

    command(command) {
        this.options.command = command;
        return this;
    }
}
