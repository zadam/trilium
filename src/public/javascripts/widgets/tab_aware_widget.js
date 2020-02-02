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
        return this.noteId === noteId;
    }

    get note() {
        return this.tabContext && this.tabContext.note;
    }

    get noteId() {
        return this.note && this.note.noteId;
    }

    get notePath() {
        return this.tabContext && this.tabContext.notePath;
    }

    tabNoteSwitchedListener({tabId, notePath}) {
        // if notePath does not match then the tabContext has been switched to another note in the mean time
        if (this.isTab(tabId) && this.notePath === notePath) {
            this.noteSwitched();
        }
    }

    noteSwitched() {
        this.refresh();
    }

    activeTabChanged() {
        this.refresh();
    }

    async isEnabled() {
        return !!this.note;
    }

    async refresh() {
        if (await this.isEnabled()) {
            const start = Date.now();

            this.toggle(true);
            await this.refreshWithNote(this.note, this.notePath);

            const end = Date.now();

            if (end - start > 10) {
                console.log(`Refresh of ${this.componentId} took ${end-start}ms`);
            }
        }
        else {
            this.toggle(false);
        }
    }

    refreshWithNote(note, notePath) {}

    activeTabChangedListener() {
        this.tabContext = this.appContext.getActiveTabContext();

        this.activeTabChanged();
    }

    treeCacheReloadedListener() {
        this.refresh();
    }
}