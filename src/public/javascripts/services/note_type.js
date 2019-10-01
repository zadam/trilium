import treeService from './tree.js';
import noteDetailService from './note_detail.js';
import server from './server.js';
import mimeTypesService from './mime_types.js';

const NOTE_TYPES = [
    { type: "file", title: "File", selectable: false },
    { type: "image", title: "Image", selectable: false },
    { type: "search", title: "Saved search", selectable: false },

    { type: "text", mime: "text/html", title: "Text", selectable: true },
    { type: "relation-map", mime: "application/json", title: "Relation Map", selectable: true },
    { type: "render", mime: '', title: "Render Note", selectable: true },
    { type: "book", mime: '', title: "Book", selectable: true },
    { type: "code", mime: 'text/plain', title: "Code", selectable: true }
];

export default class NoteTypeContext {
    /**
     * @param {TabContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;

        ctx.$tabContent.find('.note-type').on('show.bs.dropdown', () => this.renderDropdown());

        this.$noteTypeDropdown = ctx.$tabContent.find(".note-type-dropdown");
        this.$noteTypeButton = ctx.$tabContent.find(".note-type-button");
        this.$noteTypeDesc = ctx.$tabContent.find(".note-type-desc");
        this.$executeScriptButton = ctx.$tabContent.find(".execute-script-button");
        this.$renderButton = ctx.$tabContent.find('.render-button');
    }

    async update() {
        this.$noteTypeButton.prop("disabled",
            () => ["file", "image", "search"].includes(this.ctx.note.type));

        this.$noteTypeDesc.text(await this.findTypeTitle(this.ctx.note.type, this.ctx.note.mime));

        this.$executeScriptButton.toggle(this.ctx.note.mime.startsWith('application/javascript'));
        this.$renderButton.toggle(this.ctx.note.type === 'render');
    }

    /** actual body is rendered lazily on note-type button click */
    async renderDropdown() {
        this.$noteTypeDropdown.empty();

        for (const noteType of NOTE_TYPES.filter(nt => nt.selectable)) {
            const $typeLink = $('<a class="dropdown-item">')
                .attr("data-note-type", noteType.type)
                .append('<span class="check">&check;</span> ')
                .append($('<strong>').text(noteType.title))
                .click(e => {
                    const type = $typeLink.attr('data-note-type');
                    const noteType = NOTE_TYPES.find(nt => nt.type === type);

                    this.save(noteType.type, noteType.mime);
                });

            if (this.ctx.note.type === noteType.type) {
                $typeLink.addClass("selected");
            }

            this.$noteTypeDropdown.append($typeLink);

            if (noteType.type !== 'code') {
                this.$noteTypeDropdown.append('<div class="dropdown-divider"></div>');
            }
        }

        for (const mimeType of await mimeTypesService.getMimeTypes()) {
            if (!mimeType.enabled) {
                continue;
            }

            const $mimeLink = $('<a class="dropdown-item">')
                .attr("data-mime-type", mimeType.mime)
                .append('<span class="check">&check;</span> ')
                .append($('<span>').text(mimeType.title))
                .click(e => {
                    const $link = $(e.target).closest('.dropdown-item');

                    this.save('code', $link.attr('data-mime-type'))
                });

            if (this.ctx.note.type === 'code' && this.ctx.note.mime === mimeType.mime) {
                $mimeLink.addClass("selected");

                this.$noteTypeDesc.text(mimeType.title);
            }

            this.$noteTypeDropdown.append($mimeLink);
        }
    }

    async findTypeTitle(type, mime) {
        if (type === 'code') {
            const mimeTypes = await mimeTypesService.getMimeTypes();
            const found = mimeTypes.find(mt => mt.mime === mime);

            return found ? found.title : mime;
        }
        else {
            const noteType = NOTE_TYPES.find(nt => nt.type === type);

            return noteType ? noteType.title : type;
        }
    }

    async save(type, mime) {
        if (type !== this.ctx.note.type && !await this.confirmChangeIfContent()) {
            return;
        }

        await server.put('notes/' + this.ctx.note.noteId
            + '/type/' + encodeURIComponent(type)
            + '/mime/' + encodeURIComponent(mime));

        await noteDetailService.reload();

        // for the note icon to be updated in the tree
        await treeService.reload();

        this.update();
    }

    async confirmChangeIfContent() {
        if (!this.ctx.getComponent().getContent()) {
            return true;
        }

        const confirmDialog = await import("../dialogs/confirm.js");
        return await confirmDialog.confirm("It is not recommended to change note type when note content is not empty. Do you want to continue anyway?");
    }
}