import treeService from './tree.js';
import noteDetailService from './note_detail.js';
import server from './server.js';
import infoService from "./info.js";

const NOTE_TYPES = [
    { type: "file", title: "File", selectable: false },
    { type: "image", title: "Image", selectable: false },
    { type: "search", title: "Saved search", selectable: false },

    { type: "text", mime: "text/html", title: "Text", selectable: true },
    { type: "relation-map", mime: "application/json", title: "Relation Map", selectable: true },
    { type: "render", mime: '', title: "Render HTML note", selectable: true },
    { type: "code", mime: 'text/plain', title: "Code", selectable: true }
];

const DEFAULT_MIME_TYPES = [
    { mime: 'text/x-csrc', title: 'C' },
    { mime: 'text/x-c++src', title: 'C++' },
    { mime: 'text/x-csharp', title: 'C#' },
    { mime: 'text/x-clojure', title: 'Clojure' },
    { mime: 'text/css', title: 'CSS' },
    { mime: 'text/x-dockerfile', title: 'Dockerfile' },
    { mime: 'text/x-erlang', title: 'Erlang' },
    { mime: 'text/x-feature', title: 'Gherkin' },
    { mime: 'text/x-go', title: 'Go' },
    { mime: 'text/x-groovy', title: 'Groovy' },
    { mime: 'text/x-haskell', title: 'Haskell' },
    { mime: 'text/html', title: 'HTML' },
    { mime: 'message/http', title: 'HTTP' },
    { mime: 'text/x-java', title: 'Java' },
    { mime: 'application/javascript;env=frontend', title: 'JavaScript frontend' },
    { mime: 'application/javascript;env=backend', title: 'JavaScript backend' },
    { mime: 'application/json', title: 'JSON' },
    { mime: 'text/x-kotlin', title: 'Kotlin' },
    { mime: 'text/x-stex', title: 'LaTex' },
    { mime: 'text/x-lua', title: 'Lua' },
    { mime: 'text/x-markdown', title: 'Markdown' },
    { mime: 'text/x-objectivec', title: 'Objective C' },
    { mime: 'text/x-pascal', title: 'Pascal' },
    { mime: 'text/x-perl', title: 'Perl' },
    { mime: 'text/x-php', title: 'PHP' },
    { mime: 'text/x-python', title: 'Python' },
    { mime: 'text/x-ruby', title: 'Ruby' },
    { mime: 'text/x-rustsrc', title: 'Rust' },
    { mime: 'text/x-scala', title: 'Scala' },
    { mime: 'text/x-sh', title: 'Shell' },
    { mime: 'text/x-sql', title: 'SQL' },
    { mime: 'text/x-swift', title: 'Swift' },
    { mime: 'text/xml', title: 'XML' },
    { mime: 'text/x-yaml', title: 'YAML' }
];

let mimeTypes = DEFAULT_MIME_TYPES;

class NoteTypeContext {
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

    update() {
        this.$noteTypeButton.prop("disabled",
            () => ["file", "image", "search"].includes(this.ctx.note.type));

        this.$noteTypeDesc.text(this.findTypeTitle(this.ctx.note.type));
    }

    renderDropdown() {
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

        for (const mimeType of mimeTypes) {
            const $mimeLink = $('<a class="dropdown-item">')
                .attr("data-mime-type", mimeType.mime)
                .append('<span class="check">&check;</span> ')
                .append($('<span>').text(mimeType.title))
                .click(e => this.save('code', $(e.target).attr('data-mime-type')));

            if (this.ctx.note.type === 'code' && this.ctx.note.mime === mimeType.mime) {
                $mimeLink.addClass("selected");

                this.$noteTypeDesc.text(mimeType.title);
            }

            this.$noteTypeDropdown.append($mimeLink);
        }

        this.$executeScriptButton.toggle(this.ctx.note.mime.startsWith('application/javascript'));
        this.$renderButton.toggle(this.ctx.note.type === 'render');
    }

    findTypeTitle(type) {
        const noteType = NOTE_TYPES.find(nt => nt.type === type);

        return noteType ? noteType.title : type;
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

export default {
    getDefaultCodeMimeTypes: () => DEFAULT_MIME_TYPES.slice(),
    getCodeMimeTypes: () => mimeTypes,
    setCodeMimeTypes: types => { mimeTypes = types; }
};

export {
    NoteTypeContext
};