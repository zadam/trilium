import BasicWidget from "./basic_widget.js";

export default class FlexContainer extends BasicWidget {
    constructor(appContext, parent, attrs, widgetFactories) {
        super(appContext, parent);

        this.attrs = attrs;
        this.children = widgetFactories.map(wf => wf(this));
    }

    doRender() {
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