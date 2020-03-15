import BasicWidget from "./basic_widget.js";
import appContext from "../services/app_context.js";

export default class TabAwareWidget extends BasicWidget {
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

    isEnabled() {
        return !!this.note;
    }

    async refresh() {
        if (this.isEnabled()) {
            const start = Date.now();

            this.toggleInt(true);
            await this.refreshWithNote(this.note, this.notePath);

            const end = Date.now();

            if (glob.PROFILING_LOG && end - start > 10) {
                console.log(`Refresh of ${this.componentId} took ${end-start}ms`);
            }
        }
        else {
            this.toggleInt(false);
        }
    }

    async refreshWithNote(note, notePath) {}

    async tabNoteSwitchedEvent({tabContext, notePath}) {
        // if notePath does not match then the tabContext has been switched to another note in the mean time
        if (tabContext.notePath === notePath) {
            await this.noteSwitched();
        }
    }

    async noteSwitched() {
        await this.refresh();
    }

    async activeTabChangedEvent({tabContext}) {
        this.tabContext = tabContext;

        await this.activeTabChanged();
    }

    async activeTabChanged() {
        await this.refresh();
    }

    // when note is both switched and activated, this should not produce double refresh
    async tabNoteSwitchedAndActivatedEvent({tabContext, notePath}) {
        this.tabContext = tabContext;

        // if notePath does not match then the tabContext has been switched to another note in the mean time
        if (this.notePath === notePath) {
            await this.refresh();
        }
    }

    setTabContextEvent({tabContext}) {
        /** @var {TabContext} */
        this.tabContext = tabContext;
    }

    async noteTypeMimeChangedEvent({noteId}) {
        if (this.isNote(noteId)) {
            await this.refresh();
        }
    }

    async treeCacheReloadedEvent() {
        await this.refresh();
    }

    async lazyLoadedEvent() {
        if (!this.tabContext) { // has not been loaded yet
            this.tabContext = appContext.tabManager.getActiveTabContext();
        }

        await this.refresh();
    }
}