import Component from "./component.js";

class BasicWidget extends Component {
    constructor() {
        super();

        this.attrs = {
            style: ''
        };
        this.classes = [];

        this.children = [];
        this.childPositionCounter = 10;
    }

    child(...components) {
        if (!components) {
            return this;
        }

        super.child(...components);

        for (const component of components) {
            if (component.position === undefined) {
                component.position = this.childPositionCounter;
                this.childPositionCounter += 10;
            }
        }

        this.children.sort((a, b) => a.position - b.position < 0 ? -1 : 1);

        return this;
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

    contentSized() {
        this.css("contain", "none");

        return this;
    }

    overflowing() {
        console.log("Using overflowing() is deprecated NOOP and it is recommended to remove its use.");

        return this;
    }

    collapsible() {
        this.css('min-height', '0');
        this.css('min-width', '0');
        return this;
    }

    filling() {
        this.css('flex-grow', '1');
        return this;
    }

    cssBlock(block) {
        this.cssEl = block;
        return this;
    }

    render() {
        this.doRender();

        this.$widget.addClass('component')
            .prop('component', this);

        if (!this.isEnabled()) {
            this.toggleInt(false);
        }

        if (this.cssEl) {
            const css = this.cssEl.trim().startsWith('<style>') ? this.cssEl : `<style>${this.cssEl}</style>`;

            this.$widget.append(css);
        }

        for (const key in this.attrs) {
            if (key === 'style') {
                if (this.attrs[key]) {
                    let style = this.$widget.attr('style');
                    style = style ? `${style}; ${this.attrs[key]}` : this.attrs[key];

                    this.$widget.attr(key, style);
                }
            }
            else {
                this.$widget.attr(key, this.attrs[key]);
            }
        }

        for (const className of this.classes) {
            this.$widget.addClass(className);
        }

        return this.$widget;
    }

    isEnabled() {
        return true;
    }

    /**
     * for overriding
     */
    doRender() {}

    toggleInt(show) {
        this.$widget.toggleClass('hidden-int', !show);
    }

    isHiddenInt() {
        return this.$widget.hasClass('hidden-int');
    }

    toggleExt(show) {
        this.$widget.toggleClass('hidden-ext', !show);
    }

    isHiddenExt() {
        return this.$widget.hasClass('hidden-ext');
    }

    canBeShown() {
        return !this.isHiddenInt() && !this.isHiddenExt();
    }

    isVisible() {
        return this.$widget.is(":visible");
    }

    getPosition() {
        return this.position;
    }

    remove() {
        if (this.$widget) {
            this.$widget.remove();
        }
    }

    getClosestNtxId() {
        if (this.$widget) {
            return this.$widget.closest("[data-ntx-id]").attr("data-ntx-id");
        }
        else {
            return null;
        }
    }

    cleanup() {}
}

export default BasicWidget;
