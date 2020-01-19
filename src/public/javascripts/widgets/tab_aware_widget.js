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

    activeTabChanged() {
        this.refresh();
    }

    refresh() {
        if (this.tabContext && this.tabContext.note) {
            this.toggle(true);
            this.refreshWithNote();
        }
        else {
            this.toggle(false);
        }
    }

    refreshWithNote() {}

    activeTabChangedListener() {
        this.tabContext = this.appContext.getActiveTabContext();

        this.activeTabChanged();
    }
}