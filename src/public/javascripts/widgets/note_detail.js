import TabAwareWidget from "./tab_aware_widget.js";
import utils from "../services/utils.js";
import protectedSessionHolder from "../services/protected_session_holder.js";

const TPL = `
<div class="note-detail">
    <style>
    .note-detail-content {
        display: flex;
        flex-direction: column;
        flex-grow: 100;
        height: 100%;
        width: 100%;
    }  
    </style>
</div>
`;

const componentClasses = {
    'empty': "./detail/note_detail_empty.js",
    'text': "./detail/note_detail_text.js",
    'code': "./detail/note_detail_code.js",
    'file': "./detail/note_detail_file.js",
    'image': "./detail/note_detail_image.js",
    'search': "./detail/note_detail_search.js",
    'render': "./detail/note_detail_render.js",
    'relation-map': "./detail/note_detail_relation_map.js",
    'protected-session': "./detail/note_detail_protected_session.js",
    'book': "./detail/note_detail_book.js"
};

export default class NoteDetailWidget extends TabAwareWidget {
    constructor(appContext) {
        super(appContext);

        this.components = {};
        this.componentPromises = {};
    }

    doRender() {
        this.$widget = $(TPL);

        return this.$widget;
    }

    async noteSwitched() {
        await this.initComponent(/**disableAutoBook*/);

        for (const componentType in this.components) {
            if (componentType !== this.type) {
                this.components[componentType].cleanup();
            }
        }

        this.$widget.find('.note-detail-component').hide();

        this.getComponent().show();

        this.setupClasses();
    }

    setupClasses() {
        const note = this.tabContext.note;

        for (const clazz of Array.from(this.$widget[0].classList)) { // create copy to safely iterate over while removing classes
            if (clazz !== 'note-detail') {
                this.$widget.removeClass(clazz);
            }
        }

        this.$widget.addClass(note.cssClass);
        this.$widget.addClass(utils.getNoteTypeClass(note.type));
        this.$widget.addClass(utils.getMimeTypeClass(note.mime));

        this.$widget.toggleClass("protected", note.isProtected);
    }

    getComponent() {
        if (!this.components[this.type]) {
            throw new Error("Could not find component for type: " + this.type);
        }

        return this.components[this.type];
    }

    async initComponent(disableAutoBook = false) {
        this.type = this.getComponentType(disableAutoBook);

        if (!(this.type in this.componentPromises)) {
            this.componentPromises[this.type] = this.reallyInitComponent(this.type);
        }

        await this.componentPromises[this.type];
    }
    
    async reallyInitComponent(type) {
        const clazz = await import(componentClasses[type]);

        this.components[this.type] = new clazz.default(this.appContext);
        this.children.push(this.components[this.type]);

        this.components[this.type].renderTo(this.$widget);

        this.components[this.type].eventReceived('setTabContext', {tabContext: this.tabContext});
    }

    getComponentType(disableAutoBook) {
        const note = this.tabContext.note;

        if (!note) {
            return "empty";
        }

        let type = note.type;

        if (type === 'text' && !disableAutoBook && utils.isHtmlEmpty(note.content) && note.hasChildren()) {
            type = 'book';
        }

        if (note.isProtected) {
            if (protectedSessionHolder.isProtectedSessionAvailable()) {
                protectedSessionHolder.touchProtectedSession();
            } else {
                type = 'protected-session';

                // FIXME
                // user shouldn't be able to edit note title
                //this.$noteTitle.prop("readonly", true);
            }
        }

        return type;
    }
}