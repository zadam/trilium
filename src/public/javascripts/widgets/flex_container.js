import BasicWidget from "./basic_widget.js";

export default class FlexContainer extends BasicWidget {
    constructor(appContext, attrs, widgets) {
        super(appContext);

        this.attrs = attrs;
        this.children = widgets;
    }

    render() {
        this.$widget = $(`<div style="display: flex;">`);

        for (const key in this.attrs) {
            if (key === 'id') {
                this.$widget.attr(key, this.attrs[key]);
            }
            else {
                this.$widget.css(key, this.attrs[key]);
            }
        }

        for (const widget of this.children) {
            this.$widget.append(widget.render());
        }

        return this.$widget;
    }
}