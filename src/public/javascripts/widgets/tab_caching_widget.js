import TabAwareWidget from "./tab_aware_widget.js";
import keyboardActionsService from "../services/keyboard_actions.js";

export default class TabCachingWidget extends TabAwareWidget {
    constructor(widgetFactory) {
        super();

        this.widgetFactory = widgetFactory;
        this.widgets = {};
    }

    isEnabled() {
        return this.tabContext && this.tabContext.isActive();
    }

    doRender() {
        return this.$widget = $(`<div class="marker" style="display: none;">`);
    }

    async handleEventInChildren(name, data) {
        // stop propagation of the event to the children, individual tab widget should not know about tab switching
        // since they are per-tab
        if (name !== 'activeTabChanged') {
            await super.handleEventInChildren(name, data);
        }
    }

    refreshWithNote() {
        for (const widget of Object.values(this.widgets)) {
            widget.toggle(false);
        }

        if (!this.tabContext) {
            console.log(`No tabContext in widget ${this.componentId}.`);

            return;
        }

        let widget = this.widgets[this.tabContext.tabId];

        if (!widget) {
            widget = this.widgets[this.tabContext.tabId] = this.widgetFactory();

            const $renderedWidget = widget.render();
            this.$widget.after($renderedWidget);

            keyboardActionsService.updateDisplayedShortcuts($renderedWidget);

            this.child(widget); // add as child only once it is ready (also rendered)
            widget.handleEvent('setTabContext', {tabContext: this.tabContext});
        }

        widget.toggle(widget.isEnabled());
    }

    tabRemovedEvent({tabId}) {
        const widget = this.widgets[tabId];

        if (widget) {
            widget.remove();
            delete this.widgets[tabId];

            this.children = this.children.filter(ch => ch !== widget);
        }
    }

    toggle(show) {
        for (const tabId in this.widgets) {
            this.widgets[tabId].toggle(
                show
                && this.isTab(tabId)
                && this.widgets[tabId].isEnabled());
        }
    }
}