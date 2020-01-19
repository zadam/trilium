import BasicWidget from "./basic_widget.js";

export default class RowFlexContainer extends BasicWidget {
    constructor(appContext, widgets) {
        super(appContext);

        this.children = widgets;
    }

    render() {
        this.$widget = $(`<div style="display: flex; flex-direction: row;">`);

        for (const widget of this.children) {
            this.$widget.append(widget.render());
        }

        return this.$widget;
    }
}