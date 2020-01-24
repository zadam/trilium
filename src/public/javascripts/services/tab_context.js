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
import treeService from "./tree.js";

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
        this.state = state;

        this.attributes = new Attributes(this.appContext, this);

        this.children.push(this.attributes);

        this.trigger('tabOpened', {tabId: this.tabId});
    }

    async setNote(inputNotePath) {
        const notePath = await treeService.resolveNotePath(inputNotePath);

        if (!notePath) {
            console.error(`Cannot resolve note path ${inputNotePath}`);
            return;
        }

        if (notePath === this.notePath) {
            console.log(`Setting existing notePath ${notePath} so ignoring ...`);
            return;
        }

        await this.trigger('beforeNoteSwitch', {tabId: this.tabId}, true);

        this.notePath = notePath;
        const noteId = treeUtils.getNoteIdFromNotePath(notePath);

        /** @property {NoteFull} */
        this.note = await noteDetailService.loadNote(noteId);

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
        this.trigger('openTabsChanged');
    }

    async remove() {
        await this.trigger('beforeTabRemove', {tabId: this.tabId}, true);

        this.trigger('tabRemoved', {tabId: this.tabId});
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
    }

    isActive() {
        return this.appContext.activeTabId === this.tabId;
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
        appContext.openTabsChangedListener();
    }

    noteDeletedListener({noteId}) {
        if (this.note && noteId === this.note.noteId) {
            this.note = null;
            this.notePath = null;

            this.trigger('tabNoteSwitched', {tabId: this.tabId});
        }
    }
}

export default TabContext;