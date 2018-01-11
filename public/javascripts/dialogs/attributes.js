"use strict";

const attributesDialog = (function() {
    const dialogEl = $("#attributes-dialog");

    function AttributesModel(attributes) {
        const model = this;

        this.attributes = ko.observableArray(attributes);

        this.addNewRow = function() {
            model.attributes.push({
                attribute_id: '',
                name: '',
                value: ''
            });
        }
    }

    async function showDialog() {
        glob.activeDialog = dialogEl;

        dialogEl.dialog({
            modal: true,
            width: 800,
            height: 700
        });

        const noteId = noteEditor.getCurrentNoteId();

        const attributes = await server.get('notes/' + noteId + '/attributes');

        ko.applyBindings(new AttributesModel(attributes));
    }

    $(document).bind('keydown', 'alt+a', e => {
        showDialog();

        e.preventDefault();
    });

    return {
        showDialog
    };
})();