import TabAwareWidget from "./tab_aware_widget.js";

export default class TabCachingWidget extends TabAwareWidget {
    constructor(appContext, widgetFactory) {
        super(appContext);

        this.widgetFactory = widgetFactory;
        /** @type {JQuery} */
        this.$parent = null;
        this.widgets = {};
    }

    renderTo($parent) {
        this.$parent = $parent;
    }

    activeTabChanged() {
        for (const widget of Object.values(this.widgets)) {
            widget.toggle(false);
        }

        let widget = this.widgets[this.tabContext.tabId];

        if (!widget) {
            widget = this.widgets[this.tabContext.tabId] = this.widgetFactory();
            widget.renderTo(this.$parent);
            widget.activeTabChangedListener();
        }

        widget.toggle(true);
    }
}