import TabAwareWidget from "./tab_aware_widget.js";

export default class TabCachingWidget extends TabAwareWidget {
    constructor(appContext, widgetFactory) {
        super(appContext);

        this.widgetFactory = widgetFactory;
        this.widgets = {};
    }

    doRender() {
        this.$widget = $(`<div class="marker" style="display: none;">`);
        return this.$widget;
    }

    activeTabChangedListener() {
        super.activeTabChangedListener();

        for (const widget of Object.values(this.widgets)) {
            widget.toggle(false);
        }

        if (!this.tabContext) {
            console.log(`Received activeTabChanged to widget ${this.componentId} which does not have tabContext.`);

            return;
        }

        let widget = this.widgets[this.tabContext.tabId];

        if (!widget) {
            widget = this.widgets[this.tabContext.tabId] = this.widgetFactory();
            this.children.push(widget);
            this.$widget.after(widget.render());

            widget.eventReceived('setTabContext', {tabContext: this.tabContext});
        }

        widget.toggle(true);
    }

    tabRemovedListener({tabId}) {
        const widget = this.widgets[tabId];

        if (widget) {
            widget.remove();
        }
    }

    toggle(show) {
        for (const tabId in this.widgets) {
            this.widgets[tabId].toggle(show && this.tabContext && tabId === this.tabContext.tabId);
        }
    }
}