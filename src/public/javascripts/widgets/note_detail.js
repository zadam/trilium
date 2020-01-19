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

const typeWidgetClasses = {
    'empty': "./type_widgets/note_detail_empty.js",
    'text': "./type_widgets/text.js",
    'code': "./type_widgets/code.js",
    'file': "./type_widgets/file.js",
    'image': "./type_widgets/note_detail_image.js",
    'search': "./type_widgets/note_detail_search.js",
    'render': "./type_widgets/note_detail_render.js",
    'relation-map': "./type_widgets/note_detail_relation_map.js",
    'protected-session': "./type_widgets/note_detail_protected_session.js",
    'book': "./type_widgets/note_detail_book.js"
};

export default class NoteDetailWidget extends TabAwareWidget {
    constructor(appContext) {
        super(appContext);

        this.typeWidgets = {};
        this.typeWidgetPromises = {};
    }

    doRender() {
        this.$widget = $(TPL);

        return this.$widget;
    }

    async refresh() {
        this.type = this.getWidgetType(/*disableAutoBook*/);

        if (!(this.type in this.typeWidgetPromises)) {
            this.typeWidgetPromises[this.type] = this.initWidgetType(this.type);
        }

        await this.typeWidgetPromises[this.type];

        for (const typeWidget of Object.values(this.typeWidgets)) {
            if (typeWidget.constructor.getType() !== this.type) {
                typeWidget.cleanup();
                typeWidget.toggle(false);
            }
        }

        this.getTypeWidget().toggle(true);

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

    getTypeWidget() {
        if (!this.typeWidgets[this.type]) {
            throw new Error("Could not find typeWidget for type: " + this.type);
        }

        return this.typeWidgets[this.type];
    }
    
    async initWidgetType(type) {
        const clazz = await import(typeWidgetClasses[type]);

        this.typeWidgets[this.type] = new clazz.default(this.appContext);
        this.children.push(this.typeWidgets[this.type]);

        this.typeWidgets[this.type].renderTo(this.$widget);

        this.typeWidgets[this.type].eventReceived('setTabContext', {tabContext: this.tabContext});
    }

    getWidgetType(disableAutoBook) {
        const note = this.tabContext.note;

        if (!note) {
            return "empty";
        }

        let type = note.type;

        if (type === 'text' && !disableAutoBook
            && utils.isHtmlEmpty(note.content)
            && note.hasChildren()) {

            type = 'book';
        }

        if (note.isProtected && !protectedSessionHolder.isProtectedSessionAvailable()) {
            type = 'protected-session';
        }

        return type;
    }
}