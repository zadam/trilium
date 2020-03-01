import BasicWidget from "./basic_widget.js";

export default class FlexContainer extends BasicWidget {
    constructor(direction) {
        super();

        if (!direction || !['row', 'column'].includes(direction)) {
            throw new Error(`Direction argument given as "${direction}", use either 'row' or 'column'`);
        }

        this.attrs = {
            style: `display: flex; flex-direction: ${direction};`,
        };

        this.classes = [];

        this.children = [];
    }

    id(id) {
        this.attrs.id = id;
        return this;
    }

    class(className) {
        this.classes.push(className);
        return this;
    }

    css(name, value) {
        this.attrs.style += `${name}: ${value};`;
        return this;
    }

    collapsible() {
        this.css('min-height', '0');
        return this;
    }

    cssBlock(block) {
        this.cssEl = block;
        return this;
    }

    doRender() {
        this.$widget = $(`<div>`);

        if (this.cssEl) {
            const css = this.cssEl.trim().startsWith('<style>') ? this.cssEl : `<style>${this.cssEl}</style>`;

            this.$widget.append(css);
        }

        for (const key in this.attrs) {
            this.$widget.attr(key, this.attrs[key]);
        }

        for (const className of this.classes) {
            this.$widget.addClass(className);
        }

        for (const widget of this.children) {
            this.$widget.append(widget.render());
        }

        return this.$widget;
    }
}