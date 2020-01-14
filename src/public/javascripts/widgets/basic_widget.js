class BasicWidget {
    /**
     * @param {AppContext} appContext
     */
    constructor(appContext) {
        this.appContext = appContext;
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

    eventReceived(name, data) {
        console.log("received", name, "to", this.widgetId);

        const fun = this[name + 'Listener'];

        if (typeof fun === 'function') {
            fun.call(this, data);
        }
    }

    trigger(name, data) {
        this.appContext.trigger(name, data);
    }

    toggle(show) {
        this.$widget.toggle(show);
    }

    cleanup() {}
}

export default BasicWidget;