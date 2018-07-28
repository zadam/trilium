import noteDetailService from '../services/note_detail.js';
import server from '../services/server.js';
import infoService from "../services/info.js";
import linkService from "../services/link.js";
import treeUtils from "../services/tree_utils.js";

const $dialog = $("#relations-dialog");
const $saveRelationsButton = $("#save-relations-button");
const $relationsBody = $('#relations-table tbody');

const relationsModel = new RelationsModel();
let relationNames = [];

function RelationsModel() {
    const self = this;

    this.relations = ko.observableArray();

    this.updateRelationPositions = function() {
        let position = 0;

        // we need to update positions by searching in the DOM, because order of the
        // relations in the viewmodel (self.relations()) stays the same
        $relationsBody.find('input[name="position"]').each(function() {
            const relation = self.getTargetRelation(this);

            relation().position = position++;
        });
    };

    async function showRelations(relations) {
        for (const relation of relations) {
            relation.targetNoteId = await treeUtils.getNoteTitle(relation.targetNoteId) + " (" + relation.targetNoteId + ")";
        }

        self.relations(relations.map(ko.observable));
    }

    this.loadRelations = async function() {
        const noteId = noteDetailService.getCurrentNoteId();

        const relations = await server.get('notes/' + noteId + '/relations');

        await showRelations(relations);

        addLastEmptyRow();

        relationNames = await server.get('relations/names');

        // relation might not be rendered immediatelly so could not focus
        setTimeout(() => $(".relation-name:last").focus(), 100);

        $relationsBody.sortable({
            handle: '.handle',
            containment: $relationsBody,
            update: this.updateRelationPositions
        });
    };

    this.deleteRelation = function(data, event) {
        const relation = self.getTargetRelation(event.target);
        const relationData = relation();

        if (relationData) {
            relationData.isDeleted = 1;

            relation(relationData);

            addLastEmptyRow();
        }
    };

    function isValid() {
        for (let relations = self.relations(), i = 0; i < relations.length; i++) {
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
        $saveRelationsButton.focus();

        if (!isValid()) {
            alert("Please fix all validation errors and try saving again.");
            return;
        }

        self.updateRelationPositions();

        const noteId = noteDetailService.getCurrentNoteId();

        const relationsToSave = self.relations()
            .map(relation => relation())
            .filter(relation => relation.relationId !== "" || relation.name !== "");

        relationsToSave.forEach(relation => relation.targetNoteId = treeUtils.getNoteIdFromNotePath(linkService.getNotePathFromLabel(relation.targetNoteId)));

        console.log(relationsToSave);

        const relations = await server.put('notes/' + noteId + '/relations', relationsToSave);

        await showRelations(relations);

        addLastEmptyRow();

        infoService.showMessage("Relations have been saved.");

        noteDetailService.loadRelationList();
    };

    function addLastEmptyRow() {
        const relations = self.relations().filter(attr => attr().isDeleted === 0);
        const last = relations.length === 0 ? null : relations[relations.length - 1]();

        if (!last || last.name.trim() !== "" || last.targetNoteId !== "") {
            self.relations.push(ko.observable({
                relationId: '',
                name: '',
                targetNoteId: '',
                isDeleted: 0,
                position: 0
            }));
        }
    }

    this.relationChanged = function (data, event) {
        addLastEmptyRow();

        const relation = self.getTargetRelation(event.target);

        relation.valueHasMutated();
    };

    this.isNotUnique = function(index) {
        const cur = self.relations()[index]();

        if (cur.name.trim() === "") {
            return false;
        }

        for (let relations = self.relations(), i = 0; i < relations.length; i++) {
            const relation = relations[i]();

            if (index !== i && cur.name === relation.name) {
                return true;
            }
        }

        return false;
    };

    this.isEmptyName = function(index) {
        const cur = self.relations()[index]();

        return cur.name.trim() === "" && (cur.relationId !== "" || cur.targetNoteId !== "");
    };

    this.getTargetRelation = function(target) {
        const context = ko.contextFor(target);
        const index = context.$index();

        return self.relations()[index];
    }
}

async function showDialog() {
    glob.activeDialog = $dialog;

    await relationsModel.loadRelations();

    $dialog.dialog({
        modal: true,
        width: 800,
        height: 500
    });
}

ko.applyBindings(relationsModel, document.getElementById('relations-dialog'));

$dialog.on('focus', '.relation-name', function (e) {
    if (!$(this).hasClass("ui-autocomplete-input")) {
        $(this).autocomplete({
            // shouldn't be required and autocomplete should just accept array of strings, but that fails
            // because we have overriden filter() function in autocomplete.js
            source: relationNames.map(relation => {
                return {
                    label: relation,
                    value: relation
                }
            }),
            minLength: 0
        });
    }

    $(this).autocomplete("search", $(this).val());
});

async function initAutocomplete($el) {
    if (!$el.hasClass("ui-autocomplete-input")) {
        await $el.autocomplete({
            source: async function (request, response) {
                const result = await server.get('autocomplete?query=' + encodeURIComponent(request.term));

                if (result.length > 0) {
                    response(result.map(row => {
                        return {
                            label: row.label,
                            value: row.label + ' (' + row.value + ')'
                        }
                    }));
                }
                else {
                    response([{
                        label: "No results",
                        value: "No results"
                    }]);
                }
            },
            minLength: 0,
            select: function (event, ui) {
                if (ui.item.value === 'No results') {
                    return false;
                }
            }
        });
    }
}

$dialog.on('focus', '.relation-target-note-id', async function (e) {
    await initAutocomplete($(this));

    $(this).autocomplete("search", $(this).val());
});

$dialog.on('click', '.relations-show-recent-notes', async function () {
    const $autocomplete = $(this).parent().find('.relation-target-note-id');

    await initAutocomplete($autocomplete);

    $autocomplete.autocomplete("search", "");
});

export default {
    showDialog
};