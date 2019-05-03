import libraryLoader from "./library_loader.js";
import noteDetailService from './note_detail.js';
import treeService from './tree.js';
import attributeService from "./attributes.js";

class NoteDetailText {
    /**
     * @param {NoteContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.$component = ctx.$noteTabContent.find('.note-detail-text');
        this.textEditor = null;

        this.$component.on("dblclick", "img", e => {
            const $img = $(e.target);
            const src = $img.prop("src");

            const match = src.match(/\/api\/images\/([A-Za-z0-9]+)\//);

            if (match) {
                const noteId = match[1];

                treeService.activateNote(noteId);
            }
            else {
                window.open(src, '_blank');
            }
        })
    }

    async show() {
        if (!this.textEditor) {
            await libraryLoader.requireLibrary(libraryLoader.CKEDITOR);

            // CKEditor since version 12 needs the element to be visible before initialization. At the same time
            // we want to avoid flicker - i.e. show editor only once everything is ready. That's why we have separate
            // display of $component in both branches.
            this.$component.show();

            // textEditor might have been initialized during previous await so checking again
            // looks like double initialization can freeze CKEditor pretty badly
            if (!this.textEditor) {
                this.textEditor = await BalloonEditor.create(this.$component[0], {
                    placeholder: "Type the content of your note here ..."
                });

                this.onNoteChange(noteDetailService.noteChanged);
            }
        }

        this.textEditor.isReadOnly = await this.isReadOnly();

        this.$component.show();

        this.textEditor.setData(this.ctx.note.content);
    }

    getContent() {
        let content = this.textEditor.getData();

        // if content is only tags/whitespace (typically <p>&nbsp;</p>), then just make it empty
        // this is important when setting new note to code
        if (jQuery(content).text().trim() === '' && !content.includes("<img")) {
            content = '';
        }

        return content;
    }

    async isReadOnly() {
        const attributes = await attributeService.getAttributes();

        return attributes.some(attr => attr.type === 'label' && attr.name === 'readOnly');
    }

    focus() {
        this.$component.focus();
    }

    getEditor() {
        return this.textEditor;
    }

    onNoteChange(func) {
        this.textEditor.model.document.on('change:data', func);
    }


    cleanup() {
        if (this.textEditor) {
            this.textEditor.setData('');
        }
    }

    scrollToTop() {
        this.$component.scrollTop(0);
    }
}

export default NoteDetailText