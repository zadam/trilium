class BasicWidget {
    /**
     * @param {AppContext} appContext
     */
    constructor(appContext) {
        this.appContext = appContext;
        this.widgetId = `widget-${this.constructor.name}`;
    }

    render() {
        // actual rendering is async
        const $widget = this.doRender();

//        $widget.attr('id', this.widgetId);

        return $widget;
    }

    /**
     * for overriding
     */
    doRender() {}

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