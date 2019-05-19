import treeService from "./tree.js";
import protectedSessionHolder from "./protected_session_holder.js";
import server from "./server.js";
import bundleService from "./bundle.js";
import Attributes from "./attributes.js";
import treeUtils from "./tree_utils.js";
import utils from "./utils.js";
import {NoteTypeContext} from "./note_type.js";
import noteDetailService from "./note_detail.js";
import noteDetailEmpty from "./note_detail_empty.js";
import noteDetailText from "./note_detail_text.js";
import noteDetailCode from "./note_detail_code.js";
import noteDetailFile from "./note_detail_file.js";
import noteDetailImage from "./note_detail_image.js";
import noteDetailSearch from "./note_detail_search.js";
import noteDetailRender from "./note_detail_render.js";
import noteDetailRelationMap from "./note_detail_relation_map.js";
import noteDetailProtectedSession from "./note_detail_protected_session.js";
import protectedSessionService from "./protected_session.js";

const $tabContentsContainer = $("#note-tab-container");

const componentClasses = {
    'empty': noteDetailEmpty,
    'text': noteDetailText,
    'code': noteDetailCode,
    'file': noteDetailFile,
    'image': noteDetailImage,
    'search': noteDetailSearch,
    'render': noteDetailRender,
    'relation-map': noteDetailRelationMap,
    'protected-session': noteDetailProtectedSession
};

class TabContext {
    /**
     * @param {TabRow} tabRow
     */
    constructor(tabRow, tabId = null) {
        this.tabRow = tabRow;
        this.tabId = tabId || utils.randomString(4);
        this.$tab = $(this.tabRow.addTab(this.tabId));

        this.$tabContent = $(".note-tab-content-template").clone();
        this.$tabContent.removeClass('note-tab-content-template');
        this.$tabContent.attr('data-tab-id', this.tabId);

        $tabContentsContainer.append(this.$tabContent);

        this.$noteTitle = this.$tabContent.find(".note-title");
        this.$noteTitleRow = this.$tabContent.find(".note-title-row");
        this.$noteDetailComponents = this.$tabContent.find(".note-detail-component");
        this.$childrenOverview = this.$tabContent.find(".children-overview");
        this.$scriptArea = this.$tabContent.find(".note-detail-script-area");
        this.$savedIndicator = this.$tabContent.find(".saved-indicator");
        this.noteChangeDisabled = false;
        this.isNoteChanged = false;
        this.attributes = new Attributes(this);

        if (utils.isDesktop()) {
            this.noteType = new NoteTypeContext(this);
        }

        this.components = {};

        this.$noteTitle.on('input', () => {
            this.noteChanged();

            const title = this.$noteTitle.val();

            this.tabRow.updateTab(this.$tab[0], {title});
            treeService.setNoteTitle(this.noteId, title);
        });

        this.$protectButton = this.$tabContent.find(".protect-button");
        this.$protectButton.click(protectedSessionService.protectNoteAndSendToServer);

        this.$unprotectButton = this.$tabContent.find(".unprotect-button");
        this.$unprotectButton.click(protectedSessionService.unprotectNoteAndSendToServer);

        console.log(`Created note tab ${this.tabId}`);
    }

    setNote(note, notePath) {
        this.noteId = note.noteId;
        this.notePath = notePath;
        this.note = note;
        this.tabRow.updateTab(this.$tab[0], {title: note.title});

        this.attributes.invalidateAttributes();

        this.$tabContent.toggleClass("protected", this.note.isProtected);
        this.$protectButton.toggleClass("active", this.note.isProtected);
        this.$protectButton.prop("disabled", this.note.isProtected);
        this.$unprotectButton.toggleClass("active", !this.note.isProtected);
        this.$unprotectButton.prop("disabled", !this.note.isProtected || !protectedSessionHolder.isProtectedSessionAvailable());

        this.setupClasses();

        this.setCurrentNotePathToHash();

        setTimeout(async () => {
            // we include the note into recent list only if the user stayed on the note at least 5 seconds
            if (notePath && notePath === await this.notePath) {
                await server.post('recent-notes', { notePath });
            }
        }, 5000);

        console.log(`Switched tab ${this.tabId} to ${this.noteId}`);
    }

    show() {
        this.$tabContent.show();
        this.setCurrentNotePathToHash();

        document.title = "Trilium Notes";

        if (this.note) {
            // it helps navigating in history if note title is included in the title
            document.title += " - " + this.note.title;
        }
    }

    hide() {
        this.$tabContent.hide();
    }

    setCurrentNotePathToHash() {
        if (this.$tab[0] === this.tabRow.activeTabEl) {
            document.location.hash = (this.notePath || "") + "-" + this.tabId;
        }
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
    }

    getComponent() {
        let type;

        if (this.note) {
            type = this.note.type;

            if (this.note.isProtected) {
                if (protectedSessionHolder.isProtectedSessionAvailable()) {
                    protectedSessionHolder.touchProtectedSession();
                } else {
                    type = 'protected-session';

                    // user shouldn't be able to edit note title
                    this.$noteTitle.prop("readonly", true);
                }
            }
        }
        else {
            type = 'empty';
        }

        if (!(type in this.components)) {
            this.components[type] = new componentClasses[type](this);
        }

        return this.components[type];
    }

    async saveNote() {
        if (this.note.isProtected && !protectedSessionHolder.isProtectedSessionAvailable()) {
            return;
        }

        this.note.title = this.$noteTitle.val();
        this.note.content = noteDetailService.getActiveNoteContent();

        // it's important to set the flag back to false immediatelly after retrieving title and content
        // otherwise we might overwrite another change (especially async code)
        this.isNoteChanged = false;

        treeService.setNoteTitle(this.note.noteId, this.note.title);

        await server.put('notes/' + this.note.noteId, this.note.dto);

        if (this.note.isProtected) {
            protectedSessionHolder.touchProtectedSession();
        }

        this.$savedIndicator.fadeIn();

        // run async
        bundleService.executeRelationBundles(this.note, 'runOnNoteChange');
    }

    async saveNoteIfChanged() {
        if (this.isNoteChanged) {
            await this.saveNote();
        }
    }

    noteChanged() {
        if (this.noteChangeDisabled) {
            return;
        }

        this.isNoteChanged = true;

        this.$savedIndicator.fadeOut();
    }

    async showChildrenOverview() {
        const attributes = await this.attributes.getAttributes();
        const hideChildrenOverview = attributes.some(attr => attr.type === 'label' && attr.name === 'hideChildrenOverview')
            || this.note.type === 'relation-map'
            || this.note.type === 'image'
            || this.note.type === 'file';

        if (hideChildrenOverview) {
            this.$childrenOverview.hide();
            return;
        }

        this.$childrenOverview.empty();

        for (const childBranch of await this.note.getChildBranches()) {
            const link = $('<a>', {
                href: 'javascript:',
                text: await treeUtils.getNoteTitle(childBranch.noteId, childBranch.parentNoteId)
            }).attr('data-action', 'note').attr('data-note-path', this.notePath + '/' + childBranch.noteId);

            const childEl = $('<div class="child-overview-item">').html(link);
            this.$childrenOverview.append(childEl);
        }

        this.$childrenOverview.show();
    }
}

export default TabContext;