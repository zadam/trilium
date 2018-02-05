"use strict";

const attributesDialog = (function() {
    const dialogEl = $("#attributes-dialog");
    const attributesModel = new AttributesModel();
    let attributeNames = [];

    function AttributesModel() {
        const self = this;

        this.attributes = ko.observableArray();

        this.loadAttributes = async function() {
            const noteId = noteEditor.getCurrentNoteId();

            const attributes = await server.get('notes/' + noteId + '/attributes');

            self.attributes(attributes.map(ko.observable));

            addLastEmptyRow();

            attributeNames = await server.get('attributes/names');

            $(".attribute-name:last").focus();
        };

        function isValid() {
            for (let attrs = self.attributes(), i = 0; i < attrs.length; i++) {
                if (self.isEmptyName(i) || self.isNotUnique(i)) {
                    return false;
                }
            }

            return true;
        }

        this.save = async function() {
            if (!isValid()) {
                alert("Please fix all validation errors and try saving again.");
                return;
            }

            const noteId = noteEditor.getCurrentNoteId();

            const attributesToSave = self.attributes()
                .map(attr => attr())
                .filter(attr => attr.attributeId !== "" || attr.name !== "");

            const attributes = await server.put('notes/' + noteId + '/attributes', attributesToSave);

            self.attributes(attributes.map(ko.observable));

            addLastEmptyRow();

            showMessage("Attributes have been saved.");

            noteEditor.loadAttributeList();
        };

        function addLastEmptyRow() {
            const attrs = self.attributes();
            const last = attrs[attrs.length - 1]();

            if (last.name.trim() !== "" || last.value !== "") {
                self.attributes.push(ko.observable({
                    attributeId: '',
                    name: '',
                    value: ''
                }));
            }
        }

        this.attributeChanged = function (row) {
            addLastEmptyRow();

            for (const attr of self.attributes()) {
                if (row.attributeId === attr().attributeId) {
                    attr.valueHasMutated();
                }
            }
        };

        this.isNotUnique = function(index) {
            const cur = self.attributes()[index]();

            if (cur.name.trim() === "") {
                return false;
            }

            for (let attrs = self.attributes(), i = 0; i < attrs.length; i++) {
                const attr = attrs[i]();

                if (index !== i && cur.name === attr.name) {
                    return true;
                }
            }

            return false;
        };

        this.isEmptyName = function(index) {
            const cur = self.attributes()[index]();

            return cur.name.trim() === "" && (cur.attributeId !== "" || cur.value !== "");
        }
    }

    async function showDialog() {
        glob.activeDialog = dialogEl;

        await attributesModel.loadAttributes();

        dialogEl.dialog({
            modal: true,
            width: 800,
            height: 500
        });
    }

    $(document).bind('keydown', 'alt+a', e => {
        showDialog();

        e.preventDefault();
    });

    ko.applyBindings(attributesModel, document.getElementById('attributes-dialog'));

    $(document).on('focus', '.attribute-name', function (e) {
        if (!$(this).hasClass("ui-autocomplete-input")) {
            $(this).autocomplete({
                // shouldn't be required and autocomplete should just accept array of strings, but that fails
                // because we have overriden filter() function in init.js
                source: attributeNames.map(attr => {
                    return {
                        label: attr,
                        value: attr
                    }
                }),
                minLength: 0
            });
        }

        $(this).autocomplete("search", $(this).val());
    });

    $(document).on('focus', '.attribute-value', async function (e) {
        if (!$(this).hasClass("ui-autocomplete-input")) {
            const attributeName = $(this).parent().parent().find('.attribute-name').val();

            if (attributeName.trim() === "") {
                return;
            }

            const attributeValues = await server.get('attributes/values/' + encodeURIComponent(attributeName));

            if (attributeValues.length === 0) {
                return;
            }

            $(this).autocomplete({
                // shouldn't be required and autocomplete should just accept array of strings, but that fails
                // because we have overriden filter() function in init.js
                source: attributeValues.map(attr => {
                    return {
                        label: attr,
                        value: attr
                    }
                }),
                minLength: 0
            });
        }

        $(this).autocomplete("search", $(this).val());
    });

    return {
        showDialog
    };
})();