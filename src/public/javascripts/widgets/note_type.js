import treeService from '../services/tree.js';
import noteDetailService from '../services/note_detail.js';
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
<style>
.note-type-dropdown {
    max-height: 500px;
    overflow-y: auto;
    overflow-x: hidden;
}
</style>

<div class="dropdown note-type">
    <button type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" class="btn btn-sm dropdown-toggle note-type-button">
        Type: <span class="note-type-desc"></span>
        <span class="caret"></span>
    </button>
    <div class="note-type-dropdown dropdown-menu dropdown-menu-right"></div>
</div>
`;

export default class NoteTypeWidget extends TabAwareWidget {
    doRender() {
        const $widget = $(TPL);

        $widget.on('show.bs.dropdown', () => this.renderDropdown());

        this.$noteTypeDropdown = $widget.find(".note-type-dropdown");
        this.$noteTypeButton = $widget.find(".note-type-button");
        this.$noteTypeDesc = $widget.find(".note-type-desc");
        this.$executeScriptButton = $widget.find(".execute-script-button");
        this.$renderButton = $widget.find('.render-button');

        return $widget;
    }

    async refresh() {
        this.$noteTypeButton.prop("disabled",
            () => ["file", "image", "search"].includes(this.tabContext.note.type));

        this.$noteTypeDesc.text(await this.findTypeTitle(this.tabContext.note.type, this.tabContext.note.mime));

        this.$executeScriptButton.toggle(this.tabContext.note.mime.startsWith('application/javascript'));
        this.$renderButton.toggle(this.tabContext.note.type === 'render');
    }

    /** actual body is rendered lazily on note-type button click */
    async renderDropdown() {console.log("AAAAAAAAAAAAAAAAAAA");
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

            if (this.tabContext.note.type === noteType.type) {
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

            if (this.tabContext.note.type === 'code' && this.tabContext.note.mime === mimeType.mime) {
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
        if (type !== this.tabContext.note.type && !await this.confirmChangeIfContent()) {
            return;
        }

        await server.put('notes/' + this.tabContext.note.noteId
            + '/type/' + encodeURIComponent(type)
            + '/mime/' + encodeURIComponent(mime));

        await noteDetailService.reload();

        // for the note icon to be updated in the tree
        await treeService.reload();

        this.update();
    }

    async confirmChangeIfContent() {
        if (!this.tabContext.getComponent().getContent()) {
            return true;
        }

        const confirmDialog = await import("../dialogs/confirm.js");
        return await confirmDialog.confirm("It is not recommended to change note type when note content is not empty. Do you want to continue anyway?");
    }
}