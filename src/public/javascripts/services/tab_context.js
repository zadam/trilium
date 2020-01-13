import treeService from "./tree.js";
import protectedSessionHolder from "./protected_session_holder.js";
import server from "./server.js";
import bundleService from "./bundle.js";
import Attributes from "./attributes.js";
import utils from "./utils.js";
import optionsService from "./options.js";
import Sidebar from "./sidebar.js";
import appContext from "./app_context.js";

let showSidebarInNewTab = true;

optionsService.addLoadListener(options => {
    showSidebarInNewTab = options.is('showSidebarInNewTab');
});

class TabContext {
    /**
     * @param {TabRowWidget} tabRow
     * @param {object} state
     */
    constructor(tabRow, state = {}) {
        this.tabRow = tabRow;
        this.tabId = state.tabId || utils.randomString(4);
        this.$tab = $(this.tabRow.addTab(this.tabId));
        this.initialized = false;
        this.state = state;
    }

    async initTabContent() {
        if (this.initialized) {
            return;
        }

        this.initialized = true;

        this.$tabContent = $("<div>"); // FIXME

        this.noteChangeDisabled = false;
        this.isNoteChanged = false;
        this.attributes = new Attributes(this);

        if (utils.isDesktop()) {
            const sidebarState = this.state.sidebar || {
                visible: showSidebarInNewTab
            };

            this.sidebar = new Sidebar(this, sidebarState);
        }
    }

    async setNote(note, notePath) {
        /** @property {NoteFull} */
        this.note = note;
        this.notePath = notePath;
        this.tabRow.updateTab(this.$tab[0], {title: this.note.title});

        if (!this.initialized) {
            return;
        }

        if (utils.isDesktop()) {
            this.attributes.refreshAttributes();
        } else {
            // mobile usually doesn't need attributes so we just invalidate
            this.attributes.invalidateAttributes();
        }

        this.setupClasses();

        this.setCurrentNotePathToHash();

        if (this.sidebar) {
            this.sidebar.noteLoaded(); // load async
        }

        this.noteChangeDisabled = true;

        try {

        } finally {
            this.noteChangeDisabled = false;
        }

        this.setTitleBar();

        this.cleanup(); // esp. on windows autocomplete is not getting closed automatically

        setTimeout(async () => {
            // we include the note into recent list only if the user stayed on the note at least 5 seconds
            if (notePath && notePath === this.notePath) {
                await server.post('recent-notes', {
                    noteId: this.note.noteId,
                    notePath: this.notePath
                });
            }
        }, 5000);

        bundleService.executeRelationBundles(this.note, 'runOnNoteView', this);

        // after loading new note make sure editor is scrolled to the top
        // FIXME
        //this.getComponent().scrollToTop();

        appContext.trigger('activeNoteChanged');
    }

    async show() {
        if (!this.initialized) {
            await this.initTabContent();

            if (this.note) {
                await this.setNote(this.note, this.notePath);
            }
            else {
                // FIXME
                await this.renderComponent(); // render empty page
            }
        }

        if (this.sidebar) {
            this.sidebar.show();
        }

        this.setCurrentNotePathToHash();
        this.setTitleBar();
    }

    async renderComponent(disableAutoBook = false) {
        // FIXME
    }

    setTitleBar() {
        if (!this.$tabContent.is(":visible")) {
            return;
        }

        document.title = "Trilium Notes";

        if (this.note) {
            // it helps navigating in history if note title is included in the title
            document.title += " - " + this.note.title;
        }
    }

    hide() {
        if (this.initialized) {
            this.$tabContent.hide();
        }
    }

    setCurrentNotePathToHash() {
        if (this.isActive()) {
            document.location.hash = (this.notePath || "") + "-" + this.tabId;
        }
    }

    isActive() {
        return this.$tab[0] === this.tabRow.activeTabEl;
    }

    setupClasses() {
        for (const clazz of Array.from(this.$tab[0].classList)) { // create copy to safely iterate over while removing classes
            if (clazz !== 'note-tab') {
                this.$tab.removeClass(clazz);
            }
        }

        for (const clazz of Array.from(this.$tabContent[0].classList)) { // create copy to safely iterate over while removing classes
            if (clazz !== 'note-tab-content') {
                this.$tabContent.removeClass(clazz);
            }
        }

        this.$tab.addClass(this.note.cssClass);
        this.$tab.addClass(utils.getNoteTypeClass(this.note.type));
        this.$tab.addClass(utils.getMimeTypeClass(this.note.mime));

        this.$tabContent.addClass(this.note.cssClass);
        this.$tabContent.addClass(utils.getNoteTypeClass(this.note.type));
        this.$tabContent.addClass(utils.getMimeTypeClass(this.note.mime));

        this.$tabContent.toggleClass("protected", this.note.isProtected);
    }

    getComponent() {
        // FIXME
    }

    getComponentType(disableAutoBook) {
    // FIXME
    }

    async activate() {
        await this.tabRow.activateTab(this.$tab[0]);
    }

    async saveNote() {
        return; // FIXME

        if (this.note.isProtected && !protectedSessionHolder.isProtectedSessionAvailable()) {
            return;
        }

        this.note.title = this.$noteTitle.val();
        this.note.content = this.getComponent().getContent();

        // it's important to set the flag back to false immediatelly after retrieving title and content
        // otherwise we might overwrite another change (especially async code)
        this.isNoteChanged = false;

        treeService.setNoteTitle(this.note.noteId, this.note.title);

        const resp = await server.put('notes/' + this.note.noteId, this.note.dto);

        this.note.dateModified = resp.dateModified;
        this.note.utcDateModified = resp.utcDateModified;

        if (this.note.isProtected) {
            protectedSessionHolder.touchProtectedSession();
        }

        // FIXME trigger "noteSaved" event so that title indicator is triggered
        this.eventReceived('noteSaved');

        // run async
        bundleService.executeRelationBundles(this.note, 'runOnNoteChange', this);
    }

    async saveNoteIfChanged() {
        if (this.isNoteChanged) {
            await this.saveNote();

            appContext.refreshTabs(this.tabId, this.note.noteId);
        }
    }

    noteChanged() {
        if (this.noteChangeDisabled) {
            return;
        }

        this.isNoteChanged = true;

        // FIXME: trigger noteChanged event
        //this.$savedIndicator.fadeOut();
    }

    async remove() {
        if (this.$tabContent) {
            // sometimes there are orphan autocompletes after closing the tab
            this.cleanup();

            await this.saveNoteIfChanged();
            this.$tabContent.remove();
        }

        if (this.sidebar) {
            this.sidebar.remove();
        }
    }

    cleanup() {
        if (this.$tabContent && utils.isDesktop()) {
            this.$tabContent.find('.aa-input').autocomplete('close');

            $('.note-tooltip').remove();
        }
    }

    eventReceived(name, data) {
        if (!this.initialized) {
            return;
        }

        this.attributes.eventReceived(name, data);

        if (this.sidebar) {
            this.sidebar.eventReceived(name, data);
        }
    }

    getTabState() {
        if (!this.notePath) {
            return null;
        }

        return {
            tabId: this.tabId,
            notePath: this.notePath,
            active: this.tabRow.activeTabEl === this.$tab[0],
            sidebar: this.sidebar && this.sidebar.getSidebarState()
        }
    }

    stateChanged() {
        appContext.openTabsChanged();
    }
}

export default TabContext;