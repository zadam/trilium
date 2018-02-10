"use strict";

const attributesDialog = (function() {
    const $dialog = $("#attributes-dialog");
    const $saveAttributesButton = $("#save-attributes-button");
    const $attributesBody = $('#attributes-table tbody');

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

            // attribute might not be rendered immediatelly so could not focus
            setTimeout(() => $(".attribute-name:last").focus(), 100);

            $attributesBody.sortable({
                handle: '.handle',
                containment: $attributesBody,
                update: function() {
                    let position = 0;

                    $attributesBody.find('input[name="position"]').each(function() {
                        const attr = self.getTargetAttribute(this);

                        attr().position = position++;
                    });
                }
            });
        };

        this.deleteAttribute = function(data, event) {
            const attr = self.getTargetAttribute(event.target);
            const attrData = attr();

            if (attrData) {
                attrData.isDeleted = 1;

                attr(attrData);

                addLastEmptyRow();
            }
        };

        function isValid() {
            for (let attrs = self.attributes(), i = 0; i < attrs.length; i++) {
                if (self.isEmptyName(i)) {
                    return false;
                }
            }

            return true;
        }

        this.save = async function() {
            // we need to defocus from input (in case of enter-triggered save) because value is updated
            // on blur event (because of conflict with jQuery UI Autocomplete). Without this, input would
            // stay in focus, blur wouldn't be triggered and change wouldn't be updated in the viewmodel.
            $saveAttributesButton.focus();

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
            const attrs = self.attributes().filter(attr => attr().isDeleted === 0);
            const last = attrs.length === 0 ? null : attrs[attrs.length - 1]();

            if (!last || last.name.trim() !== "" || last.value !== "") {
                self.attributes.push(ko.observable({
                    attributeId: '',
                    name: '',
                    value: '',
                    isDeleted: 0,
                    position: 0
                }));
            }
        }

        this.attributeChanged = function (data, event) {
            addLastEmptyRow();

            const attr = self.getTargetAttribute(event.target);

            attr.valueHasMutated();
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
        };

        this.getTargetAttribute = function(target) {
            const context = ko.contextFor(target);
            const index = context.$index();

            return self.attributes()[index];
        }
    }

    async function showDialog() {
        glob.activeDialog = $dialog;

        await attributesModel.loadAttributes();

        $dialog.dialog({
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