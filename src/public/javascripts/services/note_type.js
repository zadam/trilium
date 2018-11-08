import treeService from './tree.js';
import noteDetailService from './note_detail.js';
import server from './server.js';
import infoService from "./info.js";

const $executeScriptButton = $("#execute-script-button");
const $toggleEditButton = $('#toggle-edit-button');
const $renderButton = $('#render-button');

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

const noteTypeModel = new NoteTypeModel();

function NoteTypeModel() {
    const self = this;

    this.type = ko.observable('text');
    this.mime = ko.observable('');

    this.codeMimeTypes = ko.observableArray(DEFAULT_MIME_TYPES);

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
        const note = noteDetailService.getCurrentNote();

        await server.put('notes/' + note.noteId
            + '/type/' + encodeURIComponent(self.type())
            + '/mime/' + encodeURIComponent(self.mime()));

        await noteDetailService.reload();

        // for the note icon to be updated in the tree
        await treeService.reload();

        self.updateExecuteScriptButtonVisibility();
    }

    this.selectText = function() {
        self.type('text');
        self.mime('');

        save();
    };

    this.selectRender = function() {
        self.type('render');
        self.mime('text/html');

        save();
    };

    this.selectRelationMap = function() {
        self.type('relation-map');
        self.mime('application/json');

        save();
    };

    this.selectCode = function() {
        self.type('code');
        self.mime('');

        save();
    };

    this.selectCodeMime = function(el) {
        self.type('code');
        self.mime(el.mime);

        save();
    };

    this.updateExecuteScriptButtonVisibility = function() {
        $executeScriptButton.toggle(self.mime().startsWith('application/javascript'));

        $toggleEditButton.toggle(self.type() === 'render');
        $renderButton.toggle(self.type() === 'render');
    }
}

ko.applyBindings(noteTypeModel, document.getElementById('note-type-wrapper'));

export default {
    getNoteType: () => noteTypeModel.type(),
    setNoteType: type => noteTypeModel.type(type),

    getNoteMime: () => noteTypeModel.mime(),
    setNoteMime: mime => {
        noteTypeModel.mime(mime);

        noteTypeModel.updateExecuteScriptButtonVisibility();
    },

    getDefaultCodeMimeTypes: () => DEFAULT_MIME_TYPES.slice(),
    getCodeMimeTypes: () => noteTypeModel.codeMimeTypes(),
    setCodeMimeTypes: types => noteTypeModel.codeMimeTypes(types)
};