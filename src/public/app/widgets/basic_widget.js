import Component from "./component.js";

class BasicWidget extends Component {
    constructor() {
        super();

        this.attrs = {
            style: ''
        };
        this.classes = [];
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

    filling() {
        this.css('flex-grow', '1');
        return this;
    }

    hideInZenMode() {
        this.class('hide-in-zen-mode');
        return this;
    }

    cssBlock(block) {
        this.cssEl = block;
        return this;
    }

    render() {
        const $widget = this.doRender();

        $widget.addClass('component')
            .prop('component', this);

        this.toggleInt(this.isEnabled());

        if (this.cssEl) {
            const css = this.cssEl.trim().startsWith('<style>') ? this.cssEl : `<style>${this.cssEl}</style>`;

            $widget.append(css);
        }

        for (const key in this.attrs) {
            if (key === 'style') {
                if (this.attrs[key]) {
                    let style = $widget.attr('style');
                    style = style ? `${style}; ${this.attrs[key]}` : this.attrs[key];

                    $widget.attr(key, style);
                }
            }
            else {
                $widget.attr(key, this.attrs[key]);
            }
        }

        for (const className of this.classes) {
            $widget.addClass(className);
        }

        return $widget;
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

    toggleExt(show) {
        this.$widget.toggleClass('hidden-ext', !show);
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

    cleanup() {}
}

export default BasicWidget;
