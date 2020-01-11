class BasicWidget {
    /**
     * @param {AppContext} appContext
     */
    constructor(appContext) {
        this.appContext = appContext;
        this.widgetId = `widget-${this.constructor.name}`;
    }

    render() {
        const $widget = $('<div>').attr('id', this.widgetId);

        // actual rendering is async
        this.doRender($widget);

        return $widget;
    }

    /**
     * for overriding
     *
     * @param {JQuery} $widget
     */
    async doRender($widget) {}

    eventReceived(name, data) {
        const fun = this[name + 'Listener'];

        if (typeof fun === 'function') {
            fun.call(this, data);
        }
    }

    trigger(name, data) {
        this.appContext.trigger(name, data);
    }

    cleanup() {}
}

export default BasicWidget;