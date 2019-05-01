import treeService from "./tree.js";
import protectedSessionHolder from "./protected_session_holder.js";
import server from "./server.js";
import bundleService from "./bundle.js";
import attributeService from "./attributes.js";
import treeUtils from "./tree_utils.js";
import utils from "./utils.js";
import noteDetailCode from "./note_detail_code.js";
import noteDetailText from "./note_detail_text.js";
import noteDetailFile from "./note_detail_file.js";
import noteDetailImage from "./note_detail_image.js";
import noteDetailSearch from "./note_detail_search.js";
import noteDetailRender from "./note_detail_render.js";
import noteDetailRelationMap from "./note_detail_relation_map.js";

const $noteTabsContainer = $("#note-tab-container");

const componentClasses = {
    'code': noteDetailCode,
    'text': noteDetailText,
    'file': noteDetailFile,
    'image': noteDetailImage,
    'search': noteDetailSearch,
    'render': noteDetailRender,
    'relation-map': noteDetailRelationMap
};

class NoteContext {
    constructor(noteId) {
        /** @type {NoteFull} */
        this.note = null;
        this.noteId = noteId;
        this.$noteTab = $noteTabsContainer.find(`[data-note-id="${noteId}"]`);
        this.$noteTitle = this.$noteTab.find(".note-title");
        this.$noteDetailComponents = this.$noteTab.find(".note-detail-component");
        this.$protectButton = this.$noteTab.find(".protect-button");
        this.$unprotectButton = this.$noteTab.find(".unprotect-button");
        this.$childrenOverview = this.$noteTab.find(".children-overview");
        this.$scriptArea = this.$noteTab.find(".note-detail-script-area");
        this.isNoteChanged = false;
        this.components = {};

        this.$noteTitle.on('input', () => {
            this.noteChanged();

            const title = this.$noteTitle.val();

            treeService.setNoteTitle(this.noteId, title);
        });
    }

    getComponent(type) {
        if (!type) {
            type = this.note.type;
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
        this.note.content = getActiveNoteContent(this.note);

        // it's important to set the flag back to false immediatelly after retrieving title and content
        // otherwise we might overwrite another change (especially async code)
        this.isNoteChanged = false;

        treeService.setNoteTitle(this.note.noteId, this.note.title);

        await server.put('notes/' + this.note.noteId, this.note.dto);

        if (this.note.isProtected) {
            protectedSessionHolder.touchProtectedSession();
        }

        $savedIndicator.fadeIn();

        // run async
        bundleService.executeRelationBundles(getActiveNote(), 'runOnNoteChange');
    }

    async saveNoteIfChanged() {
        if (this.isNoteChanged) {
            await this.saveNote();
        }
    }

    noteChanged() {
        if (noteChangeDisabled) {
            return;
        }

        this.isNoteChanged = true;

        $savedIndicator.fadeOut();
    }

    async showChildrenOverview() {
        return; // FIXME

        const attributes = await attributeService.getAttributes();
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
        this.$noteTab.toggleClass("protected", this.note.isProtected);
        this.$protectButton.toggleClass("active", this.note.isProtected);
        this.$protectButton.prop("disabled", this.note.isProtected);
        this.$unprotectButton.toggleClass("active", !this.note.isProtected);
        this.$unprotectButton.prop("disabled", !this.note.isProtected || !protectedSessionHolder.isProtectedSessionAvailable());

        for (const clazz of Array.from(this.$noteTab[0].classList)) { // create copy to safely iterate over while removing classes
            if (clazz.startsWith("type-") || clazz.startsWith("mime-")) {
                this.$noteTab.removeClass(clazz);
            }
        }

        this.$noteTab.addClass(utils.getNoteTypeClass(this.note.type));
        this.$noteTab.addClass(utils.getMimeTypeClass(this.note.mime));
    }
}

export default NoteContext;