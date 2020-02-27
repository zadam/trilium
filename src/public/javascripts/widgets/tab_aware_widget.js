import BasicWidget from "./basic_widget.js";
import appContext from "../services/app_context.js";

export default class TabAwareWidget extends BasicWidget {
    setTabContextEvent({tabContext}) {
        /** @var {TabContext} */
        this.tabContext = tabContext;
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

    tabNoteSwitchedEvent({tabId, notePath}) {
        // if notePath does not match then the tabContext has been switched to another note in the mean time
        if (this.isTab(tabId) && this.notePath === notePath) {
            this.noteSwitched();
        }
    }

    noteTypeMimeChangedEvent({noteId}) {
        if (this.noteId === noteId) {
            this.refresh();
        }
    }

    noteSwitched() {
        this.refresh();
    }

    activeTabChanged() {
        this.refresh();
    }

    isEnabled() {
        return !!this.note && this.tabContext.isActive();
    }

    async refresh() {
        if (this.isEnabled()) {
            const start = Date.now();

            this.toggle(true);
            await this.refreshWithNote(this.note, this.notePath);

            const end = Date.now();

            if (glob.PROFILING_LOG && end - start > 10) {
                console.log(`Refresh of ${this.componentId} took ${end-start}ms`);
            }
        }
        else {
            this.toggle(false);
        }
    }

    refreshWithNote(note, notePath) {}

    activeTabChangedEvent() {
        this.tabContext = appContext.tabManager.getActiveTabContext();

        this.activeTabChanged();
    }

    // when note is both switched and activated, this should not produce double refresh
    tabNoteSwitchedAndActivatedEvent() {
        this.tabContext = appContext.tabManager.getActiveTabContext();

        this.refresh();
    }

    treeCacheReloadedEvent() {
        this.refresh();
    }

    lazyLoadedEvent() {
        if (!this.tabContext) { // has not been loaded yet
            this.tabContext = appContext.tabManager.getActiveTabContext();
        }

        this.refresh();
    }
}