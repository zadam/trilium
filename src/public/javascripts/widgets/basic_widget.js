import Component from "./component.js";

class BasicWidget extends Component {
    constructor(appContext) {
        super(appContext);
        this.widgetId = `widget-${this.constructor.name}`;
    }

    renderTo($parent) {
        $parent.append(this.render());
    }

    render() {
        // actual rendering is async
        this.$widget = this.doRender();

//        $widget.attr('id', this.widgetId);

        return this.$widget;
    }

    /**
     * for overriding
     */
    doRender() {}

    toggle(show) {
        this.$widget.toggle(show);
    }

    cleanup() {}
}

export default BasicWidget;