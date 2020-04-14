import TabAwareWidget from "./tab_aware_widget.js";
import keyboardActionsService from "../services/keyboard_actions.js";

export default class TabCachingWidget extends TabAwareWidget {
    constructor(widgetFactory) {
        super();

        this.widgetFactory = widgetFactory;
        this.widgets = {};
    }

    doRender() {
        return this.$widget = $(`<div class="marker" style="display: none;">`);
    }

    async newTabOpenedEvent({tabContext}) {
        const {tabId} = tabContext;

        if (this.widgets[tabId]) {
            return;
        }

        this.widgets[tabId] = this.widgetFactory();

        const $renderedWidget = this.widgets[tabId].render();
        this.widgets[tabId].toggleExt(false); // new tab is always not active, can be activated after creation

        this.$widget.after($renderedWidget);

        keyboardActionsService.updateDisplayedShortcuts($renderedWidget);

        await this.widgets[tabId].handleEvent('setTabContext', {tabContext});

        this.child(this.widgets[tabId]); // add as child only once it is ready (rendered with tabContext)
    }

    tabRemovedEvent({tabId}) {
        const widget = this.widgets[tabId];

        if (widget) {
            widget.remove();
            delete this.widgets[tabId];

            this.children = this.children.filter(ch => ch !== widget);
        }
    }

    async refresh() {
        this.toggleExt(true);
    }

    toggleInt(show) {} // not needed

    toggleExt(show) {
        for (const tabId in this.widgets) {
            this.widgets[tabId].toggleExt(show && this.isTab(tabId));
        }
    }

    handleEventInChildren(name, data) {
        // stop propagation of the event to the children, individual tab widget should not know about tab switching
        // since they are per-tab
        if (name === 'tabNoteSwitchedAndActivated') {
            name = 'tabNoteSwitched';
        }

        if (name === 'tabNoteSwitched') {
            // this event is propagated only to the widgets of a particular tab
            const widget = this.widgets[data.tabContext.tabId];

            if (widget) {
                return widget.handleEvent(name, data);
            }
            else {
                return Promise.resolve();
            }
        }

        if (name !== 'activeTabChanged') {
            return super.handleEventInChildren(name, data);
        }

        return Promise.resolve();
    }
}