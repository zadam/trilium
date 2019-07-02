import libraryLoader from "./library_loader.js";
import treeService from './tree.js';

class NoteDetailText {
    /**
     * @param {TabContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.$component = ctx.$tabContent.find('.note-detail-text');
        this.$editorEl = this.$component.find('.note-detail-text-editor');
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

    async render() {
        if (!this.textEditor) {
            await libraryLoader.requireLibrary(libraryLoader.CKEDITOR);

            // CKEditor since version 12 needs the element to be visible before initialization. At the same time
            // we want to avoid flicker - i.e. show editor only once everything is ready. That's why we have separate
            // display of $component in both branches.
            this.$component.show();

            // textEditor might have been initialized during previous await so checking again
            // looks like double initialization can freeze CKEditor pretty badly
            if (!this.textEditor) {
                this.textEditor = await BalloonEditor.create(this.$editorEl[0], {
                    placeholder: "Type the content of your note here ..."
                });

                this.onNoteChange(() => this.ctx.noteChanged());
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
        const attributes = await this.ctx.attributes.getAttributes();

        return attributes.some(attr => attr.type === 'label' && attr.name === 'readOnly');
    }

    focus() {
        this.$editorEl.focus();
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