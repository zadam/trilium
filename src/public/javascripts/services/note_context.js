import treeService from "./tree.js";
import protectedSessionHolder from "./protected_session_holder.js";
import server from "./server.js";
import bundleService from "./bundle.js";
import Attributes from "./attributes.js";
import treeUtils from "./tree_utils.js";
import utils from "./utils.js";
import {NoteTypeContext} from "./note_type.js";
import noteDetailService from "./note_detail.js";
import noteDetailCode from "./note_detail_code.js";
import noteDetailText from "./note_detail_text.js";
import noteDetailFile from "./note_detail_file.js";
import noteDetailImage from "./note_detail_image.js";
import noteDetailSearch from "./note_detail_search.js";
import noteDetailRender from "./note_detail_render.js";
import noteDetailRelationMap from "./note_detail_relation_map.js";
import noteDetailProtectedSession from "./note_detail_protected_session.js";

const $noteTabContentsContainer = $("#note-tab-container");

const componentClasses = {
    'code': noteDetailCode,
    'text': noteDetailText,
    'file': noteDetailFile,
    'image': noteDetailImage,
    'search': noteDetailSearch,
    'render': noteDetailRender,
    'relation-map': noteDetailRelationMap,
    'protected-session': noteDetailProtectedSession
};

let tabIdCounter = 1;

class NoteContext {
    constructor(chromeTabs, note, openOnBackground) {
        this.tabId = tabIdCounter++;
        this.chromeTabs = chromeTabs;
        /** @type {NoteFull} */
        this.note = note;
        this.noteId = note.noteId;

        this.$noteTabContent = $(".note-tab-content-template").clone();
        this.$noteTabContent.removeClass('note-tab-content-template');
        this.$noteTabContent.attr('data-note-id', this.noteId);
        this.$noteTabContent.attr('data-tab-id', this.tabId);

        $noteTabContentsContainer.append(this.$noteTabContent);

        console.log(`Creating note tab ${this.tabId} for ${this.noteId}`);

        this.$noteTitle = this.$noteTabContent.find(".note-title");
        this.$noteDetailComponents = this.$noteTabContent.find(".note-detail-component");
        this.$protectButton = this.$noteTabContent.find(".protect-button");
        this.$unprotectButton = this.$noteTabContent.find(".unprotect-button");
        this.$childrenOverview = this.$noteTabContent.find(".children-overview");
        this.$scriptArea = this.$noteTabContent.find(".note-detail-script-area");
        this.$savedIndicator = this.$noteTabContent.find(".saved-indicator");
        this.noteChangeDisabled = false;
        this.isNoteChanged = false;
        this.attributes = new Attributes(this);
        this.noteType = new NoteTypeContext(this);
        this.components = {};

        this.$noteTitle.on('input', () => {
            this.noteChanged();

            const title = this.$noteTitle.val();

            treeService.setNoteTitle(this.noteId, title);
        });

        this.tab = this.chromeTabs.addTab({
            title: note.title,
            id: this.tabId
        }, {
            background: openOnBackground
        });

        this.tab.setAttribute('data-note-id', this.noteId);
    }

    setNote(note) {
        this.noteId = note.noteId;
        this.note = note;
        this.$noteTabContent.attr('data-note-id', note.noteId);

        this.chromeTabs.updateTab(this.tab, {title: note.title});

        this.attributes.invalidateAttributes();

        console.log(`Switched tab ${this.tabId} to ${this.noteId}`);
    }

    getComponent() {
        let type = this.note.type;

        if (this.note.isProtected) {
            if (protectedSessionHolder.isProtectedSessionAvailable()) {
                protectedSessionHolder.touchProtectedSession();
            }
            else {
                type = 'protected-session';

                // user shouldn't be able to edit note title
                this.$noteTitle.prop("readonly", true);
            }
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

        const notePath = await treeService.getActiveNotePath();

        for (const childBranch of await this.note.getChildBranches()) {
            const link = $('<a>', {
                href: 'javascript:',
                text: await treeUtils.getNoteTitle(childBranch.noteId, childBranch.parentNoteId)
            }).attr('data-action', 'note').attr('data-note-path', notePath + '/' + childBranch.noteId);

            const childEl = $('<div class="child-overview-item">').html(link);
            this.$childrenOverview.append(childEl);
        }

        this.$childrenOverview.show();
    }

    updateNoteView() {
        this.$noteTabContent.toggleClass("protected", this.note.isProtected);
        this.$protectButton.toggleClass("active", this.note.isProtected);
        this.$protectButton.prop("disabled", this.note.isProtected);
        this.$unprotectButton.toggleClass("active", !this.note.isProtected);
        this.$unprotectButton.prop("disabled", !this.note.isProtected || !protectedSessionHolder.isProtectedSessionAvailable());

        for (const clazz of Array.from(this.$noteTabContent[0].classList)) { // create copy to safely iterate over while removing classes
            if (clazz.startsWith("type-") || clazz.startsWith("mime-")) {
                this.$noteTabContent.removeClass(clazz);
            }
        }

        this.$noteTabContent.addClass(utils.getNoteTypeClass(this.note.type));
        this.$noteTabContent.addClass(utils.getMimeTypeClass(this.note.mime));
    }
}

export default NoteContext;