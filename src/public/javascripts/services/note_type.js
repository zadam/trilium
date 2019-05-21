import treeService from './tree.js';
import noteDetailService from './note_detail.js';
import server from './server.js';
import infoService from "./info.js";
import confirmDialog from "../dialogs/confirm.js";

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

/**
 * @param {TabContext} ctx
 * @constructor
 */
function NoteTypeContext(ctx) {
    const self = this;

    this.$executeScriptButton = ctx.$tabContent.find(".execute-script-button");
    this.$renderButton = ctx.$tabContent.find('.render-button');

    this.ctx = ctx;
    this.type = ko.observable('text');
    this.mime = ko.observable('');

    this.codeMimeTypes = ko.observableArray(mimeTypes);

    this.typeString = function() {
        const type = self.type();
        const mime = self.mime();

        if (type === 'text') {
            return 'Text';
        }
        else if (type === 'code') {
            if (!mime) {
                return 'Code';
            }
            else {
                const found = self.codeMimeTypes().find(x => x.mime === mime);

                return found ? found.title : mime;
            }
        }
        else if (type === 'render') {
            return 'Render HTML note';
        }
        else if (type === 'file') {
            return 'File';
        }
        else if (type === 'relation-map') {
            return 'Relation Map';
        }
        else if (type === 'search') {
            return 'Search note'
        }
        else if (type === 'image') {
            return 'Image'
        }
        else {
            infoService.throwError('Unrecognized type: ' + type);
        }
    };

    this.isDisabled = function() {
        return ["file", "image", "search"].includes(self.type());
    };

    async function save() {
        await server.put('notes/' + self.ctx.note.noteId
            + '/type/' + encodeURIComponent(self.type())
            + '/mime/' + encodeURIComponent(self.mime()));

        await noteDetailService.reload();

        // for the note icon to be updated in the tree
        await treeService.reload();

        self.updateExecuteScriptButtonVisibility();
    }

    function confirmChangeIfContent() {
        if (!self.ctx.getComponent().getContent()) {
            return true;
        }

        return confirmDialog.confirm("It is not recommended to change note type when note content is not empty. Do you want to continue anyway?");
    }

    this.selectText = async function() {
        if (!await confirmChangeIfContent()) {
            return;
        }

        self.type('text');
        self.mime('text/html');

        save();
    };

    this.selectRender = async function() {
        if (!await confirmChangeIfContent()) {
            return;
        }

        self.type('render');
        self.mime('text/html');

        save();
    };

    this.selectRelationMap = async function() {
        if (!await confirmChangeIfContent()) {
            return;
        }

        self.type('relation-map');
        self.mime('application/json');

        save();
    };

    this.selectCode = async function() {
        if (!await confirmChangeIfContent()) {
            return;
        }

        self.type('code');
        self.mime('text/plain');

        save();
    };

    this.selectCodeMime = async function(el) {
        if (!await confirmChangeIfContent()) {
            return;
        }

        self.type('code');
        self.mime(el.mime);

        save();
    };

    this.updateExecuteScriptButtonVisibility = function() {
        self.$executeScriptButton.toggle(ctx.note.mime.startsWith('application/javascript'));
        self.$renderButton.toggle(ctx.note.type === 'render');
    };

    ko.applyBindings(this, ctx.$tabContent.find('.note-type-wrapper')[0])
}

export default {
    getDefaultCodeMimeTypes: () => DEFAULT_MIME_TYPES.slice(),
    getCodeMimeTypes: () => mimeTypes,
    setCodeMimeTypes: types => { mimeTypes = types; }
};

export {
    NoteTypeContext
};