"use strict";

import noteEditor from '../note_editor.js';
import utils from '../utils.js';

const $showDialogButton = $(".show-labels-button");
const $dialog = $("#labels-dialog");
const $saveLabelsButton = $("#save-labels-button");
const $labelsBody = $('#labels-table tbody');

const labelsModel = new LabelsModel();
let labelNames = [];

function LabelsModel() {
    const self = this;

    this.labels = ko.observableArray();

    this.loadLabels = async function() {
        const noteId = noteEditor.getCurrentNoteId();

        const labels = await server.get('notes/' + noteId + '/labels');

        self.labels(labels.map(ko.observable));

        addLastEmptyRow();

        labelNames = await server.get('labels/names');

        // label might not be rendered immediatelly so could not focus
        setTimeout(() => $(".label-name:last").focus(), 100);

        $labelsBody.sortable({
            handle: '.handle',
            containment: $labelsBody,
            update: function() {
                let position = 0;

                // we need to update positions by searching in the DOM, because order of the
                // labels in the viewmodel (self.labels()) stays the same
                $labelsBody.find('input[name="position"]').each(function() {
                    const attr = self.getTargetLabel(this);

                    attr().position = position++;
                });
            }
        });
    };

    this.deleteLabel = function(data, event) {
        const attr = self.getTargetLabel(event.target);
        const attrData = attr();

        if (attrData) {
            attrData.isDeleted = 1;

            attr(attrData);

            addLastEmptyRow();
        }
    };

    function isValid() {
        for (let attrs = self.labels(), i = 0; i < attrs.length; i++) {
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
        $saveLabelsButton.focus();

        if (!isValid()) {
            alert("Please fix all validation errors and try saving again.");
            return;
        }

        const noteId = noteEditor.getCurrentNoteId();

        const labelsToSave = self.labels()
            .map(attr => attr())
            .filter(attr => attr.labelId !== "" || attr.name !== "");

        const labels = await server.put('notes/' + noteId + '/labels', labelsToSave);

        self.labels(labels.map(ko.observable));

        addLastEmptyRow();

        utils.showMessage("Labels have been saved.");

        noteEditor.loadLabelList();
    };

    function addLastEmptyRow() {
        const attrs = self.labels().filter(attr => attr().isDeleted === 0);
        const last = attrs.length === 0 ? null : attrs[attrs.length - 1]();

        if (!last || last.name.trim() !== "" || last.value !== "") {
            self.labels.push(ko.observable({
                labelId: '',
                name: '',
                value: '',
                isDeleted: 0,
                position: 0
            }));
        }
    }

    this.labelChanged = function (data, event) {
        addLastEmptyRow();

        const attr = self.getTargetLabel(event.target);

        attr.valueHasMutated();
    };

    this.isNotUnique = function(index) {
        const cur = self.labels()[index]();

        if (cur.name.trim() === "") {
            return false;
        }

        for (let attrs = self.labels(), i = 0; i < attrs.length; i++) {
            const attr = attrs[i]();

            if (index !== i && cur.name === attr.name) {
                return true;
            }
        }

        return false;
    };

    this.isEmptyName = function(index) {
        const cur = self.labels()[index]();

        return cur.name.trim() === "" && (cur.labelId !== "" || cur.value !== "");
    };

    this.getTargetLabel = function(target) {
        const context = ko.contextFor(target);
        const index = context.$index();

        return self.labels()[index];
    }
}

async function showDialog() {
    glob.activeDialog = $dialog;

    await labelsModel.loadLabels();

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

ko.applyBindings(labelsModel, document.getElementById('labels-dialog'));

$(document).on('focus', '.label-name', function (e) {
    if (!$(this).hasClass("ui-autocomplete-input")) {
        $(this).autocomplete({
            // shouldn't be required and autocomplete should just accept array of strings, but that fails
            // because we have overriden filter() function in init.js
            source: labelNames.map(attr => {
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

$(document).on('focus', '.label-value', async function (e) {
    if (!$(this).hasClass("ui-autocomplete-input")) {
        const labelName = $(this).parent().parent().find('.label-name').val();

        if (labelName.trim() === "") {
            return;
        }

        const labelValues = await server.get('labels/values/' + encodeURIComponent(labelName));

        if (labelValues.length === 0) {
            return;
        }

        $(this).autocomplete({
            // shouldn't be required and autocomplete should just accept array of strings, but that fails
            // because we have overriden filter() function in init.js
            source: labelValues.map(attr => {
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

$showDialogButton.click(showDialog);

export default {
    showDialog
};