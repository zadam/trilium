import BasicWidget from "../basic_widget.js";

export default class Container extends BasicWidget {
    doRender() {
        this.$widget = $(`<div>`);
        this.renderChildren();
    }

    renderChildren() {
        for (const widget of this.children) {
            this.$widget.append(widget.render());
        }
    }
}
