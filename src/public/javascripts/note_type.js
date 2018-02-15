"use strict";

const noteType = (function() {
    const $executeScriptButton = $("#execute-script-button");
    const noteTypeModel = new NoteTypeModel();

    function NoteTypeModel() {
        const self = this;

        this.type = ko.observable('text');
        this.mime = ko.observable('');

        this.codeMimeTypes = ko.observableArray([
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
            { mime: 'application/javascript', title: 'JavaScript' },
            { mime: 'application/json', title: 'JSON' },
            { mime: 'text/x-kotlin', title: 'Kotlin' },
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
        ]);

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
            else {
                throwError('Unrecognized type: ' + type);
            }
        };

        async function save() {
            const note = noteEditor.getCurrentNote();

            await server.put('notes/' + note.detail.noteId
                + '/type/' + encodeURIComponent(self.type())
                + '/mime/' + encodeURIComponent(self.mime()));

            await noteEditor.reload();

            // for the note icon to be updated in the tree
            await noteTree.reload();

            self.updateExecuteScriptButtonVisibility();
        }

        this.selectText = function() {
            self.type('text');
            self.mime('');

            save();
        };

        this.selectRender = function() {
            self.type('render');
            self.mime('');

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
            $executeScriptButton.toggle(self.mime() === 'application/javascript');
        }
    }

    ko.applyBindings(noteTypeModel, document.getElementById('note-type'));

    return {
        getNoteType: () => noteTypeModel.type(),
        setNoteType: type => noteTypeModel.type(type),

        getNoteMime: () => noteTypeModel.mime(),
        setNoteMime: mime => {
            noteTypeModel.mime(mime);

            noteTypeModel.updateExecuteScriptButtonVisibility();
        }
    };
})();