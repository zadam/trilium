import BasicWidget from "./basic_widget.js";

export default class FlexContainer extends BasicWidget {
    constructor(direction) {
        super();

        if (!direction || !['row', 'column'].includes(direction)) {
            throw new Error(`Direction argument given as "${direction}", use either 'row' or 'column'`);
        }

        this.attrs.style = `display: flex; flex-direction: ${direction};`;

        this.children = [];
    }

    doRender() {
        this.$widget = $(`<div>`);

        for (const widget of this.children) {
            this.$widget.append(widget.render());
        }

        return this.$widget;
    }
}