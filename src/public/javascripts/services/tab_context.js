import treeService from "./tree.js";
import protectedSessionHolder from "./protected_session_holder.js";
import server from "./server.js";
import bundleService from "./bundle.js";
import Attributes from "./attributes.js";
import utils from "./utils.js";
import optionsService from "./options.js";
import appContext from "./app_context.js";
import treeUtils from "./tree_utils.js";
import noteDetailService from "./note_detail.js";
import Component from "../widgets/component.js";

let showSidebarInNewTab = true;

optionsService.addLoadListener(options => {
    showSidebarInNewTab = options.is('showSidebarInNewTab');
});

class TabContext extends Component {
    /**
     * @param {AppContext} appContext
     * @param {TabRowWidget} tabRow
     * @param {object} state
     */
    constructor(appContext, tabRow, state = {}) {
        super(appContext);

        this.tabRow = tabRow;
        this.tabId = state.tabId || utils.randomString(4);
        this.$tab = $(this.tabRow.addTab(this.tabId));
        this.state = state;

        this.attributes = new Attributes(this.appContext, this);

        this.children.push(this.attributes);
    }

    async setNote(notePath) {
        await this.trigger('beforeNoteSwitch', {tabId: this.tabId}, true);

        this.notePath = notePath;
        const noteId = treeUtils.getNoteIdFromNotePath(notePath);

        /** @property {NoteFull} */
        this.note = await noteDetailService.loadNote(noteId);

        this.tabRow.updateTab(this.$tab[0], {title: this.note.title});

        this.setupClasses();

        //this.cleanup(); // esp. on windows autocomplete is not getting closed automatically

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

        if (this.note.isProtected && protectedSessionHolder.isProtectedSessionAvailable()) {
            // FIXME: there are probably more places where this should be done
            protectedSessionHolder.touchProtectedSession();
        }

        this.trigger('tabNoteSwitched', {tabId: this.tabId});
    }

    async show() {
    }

    hide() {
        // FIXME
    }

    isActive() {
        return this.tabId === this.tabRow.activeTabId;
    }

    async remove() {
        await this.trigger('beforeTabRemove', {tabId: this.tabId}, true);

        this.trigger('tabRemoved', {tabId: this.tabId});
    }

    setupClasses() {
        for (const clazz of Array.from(this.$tab[0].classList)) { // create copy to safely iterate over while removing classes
            if (clazz !== 'note-tab') {
                this.$tab.removeClass(clazz);
            }
        }

        this.$tab.addClass(this.note.cssClass);
        this.$tab.addClass(utils.getNoteTypeClass(this.note.type));
        this.$tab.addClass(utils.getMimeTypeClass(this.note.mime));
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

        const resp = await server.put('notes/' + this.note.noteId, this.note.dto);

        this.note.dateModified = resp.dateModified;
        this.note.utcDateModified = resp.utcDateModified;

        if (this.note.isProtected) {
            protectedSessionHolder.touchProtectedSession();
        }

        // FIXME trigger "noteSaved" event so that title indicator is triggered
        this.eventReceived('noteSaved');


    }

    async saveNoteIfChanged() {
        if (this.isNoteChanged) {
            await this.saveNote();

            appContext.refreshTabs(this.tabId, this.note.noteId);
        }
    }

    getTabState() {
        if (!this.notePath) {
            return null;
        }

        return {
            tabId: this.tabId,
            notePath: this.notePath,
            active: this.tabRow.activeTabId === this.tabId
        }
    }

    stateChanged() {
        appContext.openTabsChanged();
    }
}

export default TabContext;