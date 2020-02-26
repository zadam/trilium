import BasicWidget from "./basic_widget.js";

export default class FlexContainer extends BasicWidget {
    constructor(direction) {
        super();

        if (!direction) {
            throw new Error(`Direction argument missing, use either 'row' or 'column'`);
        }

        this.attrs = {
            style: 'display: flex;'
        };

        this.children = [];
    }

    id(id) {
        this.attrs.id = id;
        return this;
    }

    css(name, value) {
        this.attrs.style += `${name}: ${value};`;
        return this;
    }

    rowFlex() {
        this.css('flex-direction', 'row');
        return this;
    }

    columnFlex() {
        this.css('flex-direction', 'column');
        return this;
    }

    cssBlock(block) {
        this.cssEl = block;
        return this;
    }

    child(widgetFactory) {
        this.children = widgetFactory(this);
    }

    doRender() {
        this.$widget = $(`<div>`);

        if (this.cssEl) {
            this.$widget.append($(`<style>`).append(this.cssEl));
        }

        for (const key in this.attrs) {
            this.$widget.attr(key, this.attrs[key]);
        }

        if (!this.children)

        for (const widget of this.children) {
            this.$widget.append(widget.render());
        }

        return this.$widget;
    }
}