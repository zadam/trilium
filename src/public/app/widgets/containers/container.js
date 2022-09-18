import BasicWidget from "../basic_widget.js";

export default class Container extends BasicWidget {
    doRender() {
        this.$widget = $(`<div>`);

        for (const widget of this.children) {
            this.$widget.append(widget.render());
        }
    }
}
