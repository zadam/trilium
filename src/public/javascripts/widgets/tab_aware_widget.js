import BasicWidget from "./basic_widget.js";

export default class TabAwareWidget extends BasicWidget {
    setTabContextListener({tabContext}) {
        /** @var {TabContext} */
        this.tabContext = tabContext;

        this.noteSwitched();
    }

    isTab(tabId) {
        return this.tabContext && this.tabContext.tabId === tabId;
    }

    isNote(noteId) {
        return this.tabContext && this.tabContext.note && this.tabContext.note.noteId === noteId;
    }

    tabNoteSwitchedListener({tabId}) {
        if (this.isTab(tabId)) {
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
            this.refreshWithNote(this.tabContext.note, this.tabContext.notePath);
        }
        else {
            this.toggle(false);
        }
    }

    refreshWithNote(note) {}

    activeTabChangedListener() {
        this.tabContext = this.appContext.getActiveTabContext();

        this.activeTabChanged();
    }
}