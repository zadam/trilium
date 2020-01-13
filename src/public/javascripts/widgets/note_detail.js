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
    'empty': "../services/note_detail_empty.js",
    'text': "../services/note_detail_text.js",
    'code': "../services/note_detail_code.js",
    'file': "../services/note_detail_file.js",
    'image': "../services/note_detail_image.js",
    'search': "../services/note_detail_search.js",
    'render': "../services/note_detail_render.js",
    'relation-map': "../services/note_detail_relation_map.js",
    'protected-session': "../services/note_detail_protected_session.js",
    'book': "../services/note_detail_book.js"
};

export default class NoteDetailWidget extends TabAwareWidget {
    constructor(appContext) {
        super(appContext);

        this.components = {};
    }

    doRender() {
        this.$widget = $(TPL);

        return this.$widget;
    }

    async activeTabChanged() {
        await this.initComponent(/**disableAutoBook*/);

        for (const componentType in this.components) {
            // FIXME
            this.components[componentType].ctx = this.tabContext;

            if (componentType !== this.type) {
                this.components[componentType].cleanup();
            }
        }

        this.$widget.find('.note-detail-component').hide();

        this.getComponent().show();
        await this.getComponent().render();
    }

    getComponent() {
        if (!this.components[this.type]) {
            throw new Error("Could not find component for type: " + this.type);
        }

        return this.components[this.type];
    }

    async initComponent(disableAutoBook = false) {
        this.type = this.getComponentType(disableAutoBook);

        if (!(this.type in this.components)) {
            const clazz = await import(componentClasses[this.type]);

            this.components[this.type] = new clazz.default(this, this.$widget);
        }
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