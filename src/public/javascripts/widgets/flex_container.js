import BasicWidget from "./basic_widget.js";

export default class FlexContainer extends BasicWidget {
    constructor(direction) {
        super();

        if (!direction || !['row', 'column'].includes(direction)) {
            throw new Error(`Direction argument given as "${direction}", use either 'row' or 'column'`);
        }

        this.attrs.style = `display: flex; flex-direction: ${direction};`;

        this.children = [];

        this.positionCounter = 10;
    }

    child(...components) {
        if (!components) {
            return this;
        }

        super.child(...components);

        for (const component of components) {
            if (!component.position) {
                component.position = this.positionCounter;
                this.positionCounter += 10;
            }
        }

        this.children.sort((a, b) => a.position - b.position < 0 ? -1 : 1);

        return this;
    }

    doRender() {
        this.$widget = $(`<div>`);

        for (const widget of this.children) {
            this.$widget.append(widget.render());
        }

        return this.$widget;
    }
}