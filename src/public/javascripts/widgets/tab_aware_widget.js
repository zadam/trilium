import BasicWidget from "./basic_widget.js";

export default class TabAwareWidget extends BasicWidget {
    setTabContext(tabContext) {
        /** @var {TabContext} */
        this.tabContext = tabContext;

        this.eventReceived('tabNoteSwitched', {tabId: this.tabContext.tabId});
    }

    tabNoteSwitchedListener({tabId}) {
        if (this.tabContext && tabId === this.tabContext.tabId) {
            this.noteSwitched();
        }
    }

    noteSwitched() {}

    // to override
    activeTabChanged() {}

    activeTabChangedListener() {
        this.tabContext = this.appContext.getActiveTabContext();

        this.activeTabChanged();
    }
}