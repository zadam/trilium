import noteDetailService from '../services/note_detail.js';
import server from '../services/server.js';
import infoService from "../services/info.js";

const $dialog = $("#labels-dialog");
const $saveLabelsButton = $("#save-labels-button");
const $labelsBody = $('#labels-table tbody');

const labelsModel = new LabelsModel();
let labelNames = [];

function LabelsModel() {
    const self = this;

    this.labels = ko.observableArray();

    this.updateLabelPositions = function() {
        let position = 0;

        // we need to update positions by searching in the DOM, because order of the
        // labels in the viewmodel (self.labels()) stays the same
        $labelsBody.find('input[name="position"]').each(function() {
            const label = self.getTargetLabel(this);

            label().position = position++;
        });
    };

    this.loadLabels = async function() {
        const noteId = noteDetailService.getCurrentNoteId();

        const labels = await server.get('notes/' + noteId + '/labels');

        self.labels(labels.map(ko.observable));

        addLastEmptyRow();

        labelNames = await server.get('labels/names');

        // label might not be rendered immediatelly so could not focus
        setTimeout(() => $(".label-name:last").focus(), 100);

        $labelsBody.sortable({
            handle: '.handle',
            containment: $labelsBody,
            update: this.updateLabelPositions
        });
    };

    this.deleteLabel = function(data, event) {
        const label = self.getTargetLabel(event.target);
        const labelData = label();

        if (labelData) {
            labelData.isDeleted = true;

            label(labelData);

            addLastEmptyRow();
        }
    };

    function isValid() {
        for (let labels = self.labels(), i = 0; i < labels.length; i++) {
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

        self.updateLabelPositions();

        const noteId = noteDetailService.getCurrentNoteId();

        const labelsToSave = self.labels()
            .map(label => label())
            .filter(label => label.labelId !== "" || label.name !== "");

        const labels = await server.put('notes/' + noteId + '/labels', labelsToSave);

        self.labels(labels.map(ko.observable));

        addLastEmptyRow();

        infoService.showMessage("Labels have been saved.");

        noteDetailService.loadLabelList();
    };

    function addLastEmptyRow() {
        const labels = self.labels().filter(attr => !attr().isDeleted);
        const last = labels.length === 0 ? null : labels[labels.length - 1]();

        if (!last || last.name.trim() !== "" || last.value !== "") {
            self.labels.push(ko.observable({
                labelId: '',
                name: '',
                value: '',
                isDeleted: false,
                position: 0
            }));
        }
    }

    this.labelChanged = function (data, event) {
        addLastEmptyRow();

        const label = self.getTargetLabel(event.target);

        label.valueHasMutated();
    };

    this.isNotUnique = function(index) {
        const cur = self.labels()[index]();

        if (cur.name.trim() === "") {
            return false;
        }

        for (let labels = self.labels(), i = 0; i < labels.length; i++) {
            const label = labels[i]();

            if (index !== i && cur.name === label.name) {
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

ko.applyBindings(labelsModel, $dialog[0]);

$dialog.on('focus', '.label-name', function (e) {
    if (!$(this).hasClass("ui-autocomplete-input")) {
        $(this).autocomplete({
            // shouldn't be required and autocomplete should just accept array of strings, but that fails
            // because we have overriden filter() function in autocomplete.js
            source: labelNames.map(label => {
                return {
                    label: label,
                    value: label
                }
            }),
            minLength: 0
        });
    }

    $(this).autocomplete("search", $(this).val());
});

$dialog.on('focus', '.label-value', async function (e) {
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
            // because we have overriden filter() function in autocomplete.js
            source: labelValues.map(label => {
                return {
                    label: label,
                    value: label
                }
            }),
            minLength: 0
        });
    }

    $(this).autocomplete("search", $(this).val());
});

export default {
    showDialog
};