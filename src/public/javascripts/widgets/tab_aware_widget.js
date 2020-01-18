import BasicWidget from "./basic_widget.js";

export default class TabAwareWidget extends BasicWidget {
    setTabContextListener({tabContext}) {
        /** @var {TabContext} */
        this.tabContext = tabContext;

        this.noteSwitched();
    }

    tabNoteSwitchedListener({tabId}) {
        if (this.tabContext && tabId === this.tabContext.tabId) {
            this.noteSwitched();
        }
    }

    noteSwitched() {
        this.refresh();
    }

    // to override
    activeTabChanged() {
        this.refresh();
    }

    refresh() {}

    activeTabChangedListener() {
        this.tabContext = this.appContext.getActiveTabContext();

        this.activeTabChanged();
    }
}