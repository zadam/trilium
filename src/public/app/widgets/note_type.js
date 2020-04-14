import server from '../services/server.js';
import mimeTypesService from '../services/mime_types.js';
import TabAwareWidget from "./tab_aware_widget.js";

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

const TPL = `
<div class="dropdown note-type">
    <style>
    .note-type-dropdown {
        max-height: 500px;
        overflow-y: auto;
        overflow-x: hidden;
    }
    </style>
    <button type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" class="btn btn-sm dropdown-toggle note-type-button">
        Type: <span class="note-type-desc"></span>
        <span class="caret"></span>
    </button>
    <div class="note-type-dropdown dropdown-menu dropdown-menu-right"></div>
</div>
`;

export default class NoteTypeWidget extends TabAwareWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$widget.on('show.bs.dropdown', () => this.renderDropdown());

        this.$noteTypeDropdown = this.$widget.find(".note-type-dropdown");
        this.$noteTypeButton = this.$widget.find(".note-type-button");
        this.$noteTypeDesc = this.$widget.find(".note-type-desc");

        return this.$widget;
    }

    async refreshWithNote(note) {
        this.$noteTypeButton.prop("disabled",
            () => ["file", "image", "search"].includes(note.type));

        this.$noteTypeDesc.text(await this.findTypeTitle(note.type, note.mime));
    }

    /** actual body is rendered lazily on note-type button click */
    async renderDropdown() {
        this.$noteTypeDropdown.empty();

        for (const noteType of NOTE_TYPES.filter(nt => nt.selectable)) {
            const $typeLink = $('<a class="dropdown-item">')
                .attr("data-note-type", noteType.type)
                .append('<span class="check">&check;</span> ')
                .append($('<strong>').text(noteType.title))
                .on('click', e => {
                    const type = $typeLink.attr('data-note-type');
                    const noteType = NOTE_TYPES.find(nt => nt.type === type);

                    this.save(noteType.type, noteType.mime);
                });

            if (this.note.type === noteType.type) {
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
                .on('click', e => {
                    const $link = $(e.target).closest('.dropdown-item');

                    this.save('code', $link.attr('data-mime-type'))
                });

            if (this.note.type === 'code' && this.note.mime === mimeType.mime) {
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
        if (type === this.note.type && mime === this.note.mime) {
            return;
        }

        if (type !== this.note.type && !await this.confirmChangeIfContent()) {
            return;
        }

        await server.put('notes/' + this.noteId
            + '/type/' + encodeURIComponent(type)
            + '/mime/' + encodeURIComponent(mime));
    }

    async confirmChangeIfContent() {
        const noteComplement = await this.tabContext.getNoteComplement();

        if (!noteComplement.content || !noteComplement.content.trim().length) {
            return true;
        }

        const confirmDialog = await import("../dialogs/confirm.js");
        return await confirmDialog.confirm("It is not recommended to change note type when note content is not empty. Do you want to continue anyway?");
    }

    async entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId, this.componentId)) {
            this.refresh();
        }
    }
}