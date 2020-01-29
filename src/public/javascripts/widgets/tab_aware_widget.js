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
        if (this.note) {
            this.toggle(true);
            this.refreshWithNote(this.note, this.notePath);
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

    entitiesReloadedListener({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId, this.componentId)) {
            this.refreshWithNote(this.note, this.notePath);
        }
    }
}