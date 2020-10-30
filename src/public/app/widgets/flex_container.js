import AbstractContainer from "./abstract_container.js";

export default class FlexContainer extends AbstractContainer {
    constructor(direction) {
        super();

        if (!direction || !['row', 'column'].includes(direction)) {
            throw new Error(`Direction argument given as "${direction}", use either 'row' or 'column'`);
        }

        this.attrs.style = `display: flex; flex-direction: ${direction};`;
    }

    doRender() {
        this.$widget = $(`<div>`);

        for (const widget of this.children) {
            this.$widget.append(widget.render());
        }
    }
}
