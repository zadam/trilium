"use strict";

const attributesDialog = (function() {
    const dialogEl = $("#attributes-dialog");
    const attributesModel = new AttributesModel();

    function AttributesModel() {
        const self = this;

        this.attributes = ko.observableArray();

        this.loadAttributes = async function() {
            const noteId = noteEditor.getCurrentNoteId();

            const attributes = await server.get('notes/' + noteId + '/attributes');

            this.attributes(attributes);
        };

        this.addNewRow = function() {
            self.attributes.push({
                attributeId: '',
                name: '',
                value: ''
            });
        };

        this.save = async function() {
            const noteId = noteEditor.getCurrentNoteId();

            const attributes = await server.put('notes/' + noteId + '/attributes', this.attributes());

            self.attributes(attributes);

            showMessage("Attributes have been saved.");
        };
    }

    async function showDialog() {
        glob.activeDialog = dialogEl;

        dialogEl.dialog({
            modal: true,
            width: 800,
            height: 700
        });

        attributesModel.loadAttributes();
    }

    $(document).bind('keydown', 'alt+a', e => {
        showDialog();

        e.preventDefault();
    });

    ko.applyBindings(attributesModel, document.getElementById('attributes-dialog'));

    return {
        showDialog
    };
})();