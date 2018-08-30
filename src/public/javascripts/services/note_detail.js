import treeService from './tree.js';
import treeUtils from './tree_utils.js';
import noteTypeService from './note_type.js';
import protectedSessionService from './protected_session.js';
import protectedSessionHolder from './protected_session_holder.js';
import utils from './utils.js';
import server from './server.js';
import messagingService from "./messaging.js";
import infoService from "./info.js";
import linkService from "./link.js";
import treeCache from "./tree_cache.js";
import NoteFull from "../entities/note_full.js";
import noteDetailCode from './note_detail_code.js';
import noteDetailText from './note_detail_text.js';
import noteDetailFile from './note_detail_file.js';
import noteDetailSearch from './note_detail_search.js';
import noteDetailRender from './note_detail_render.js';
import bundleService from "./bundle.js";
import noteAutocompleteService from "./note_autocomplete.js";

const $noteTitle = $("#note-title");

const $noteDetailComponents = $(".note-detail-component");

const $protectButton = $("#protect-button");
const $unprotectButton = $("#unprotect-button");
const $noteDetailWrapper = $("#note-detail-wrapper");
const $noteIdDisplay = $("#note-id-display");
const $attributeList = $("#attribute-list");
const $attributeListInner = $("#attribute-list-inner");
const $childrenOverview = $("#children-overview");
const $scriptArea = $("#note-detail-script-area");
const $promotedAttributesContainer = $("#note-detail-promoted-attributes");

let currentNote = null;

let noteChangeDisabled = false;

let isNoteChanged = false;

let attributePromise;

const components = {
    'code': noteDetailCode,
    'text': noteDetailText,
    'file': noteDetailFile,
    'search': noteDetailSearch,
    'render': noteDetailRender
};

function getComponent(type) {
    if (components[type]) {
        return components[type];
    }
    else {
        infoService.throwError("Unrecognized type: " + type);
    }
}

function getCurrentNote() {
    return currentNote;
}

function getCurrentNoteId() {
    return currentNote ? currentNote.noteId : null;
}

function getCurrentNoteType() {
    const currentNote = getCurrentNote();

    return currentNote ? currentNote.type : null;
}

function noteChanged() {
    if (noteChangeDisabled) {
        return;
    }

    isNoteChanged = true;
}

async function reload() {
    // no saving here

    await loadNoteDetail(getCurrentNoteId());
}

async function switchToNote(noteId) {
    if (getCurrentNoteId() !== noteId) {
        await saveNoteIfChanged();

        await loadNoteDetail(noteId);
    }
}

async function saveNote() {
    const note = getCurrentNote();

    note.title = $noteTitle.val();
    note.content = getComponent(note.type).getContent();

    // it's important to set the flag back to false immediatelly after retrieving title and content
    // otherwise we might overwrite another change (especially async code)
    isNoteChanged = false;

    treeService.setNoteTitle(note.noteId, note.title);

    await server.put('notes/' + note.noteId, note.dto);


    if (note.isProtected) {
        protectedSessionHolder.touchProtectedSession();
    }

    infoService.showMessage("Saved!");
}

async function saveNoteIfChanged() {
    if (!isNoteChanged) {
        return;
    }

    await saveNote();
}

function setNoteBackgroundIfProtected(note) {
    $noteDetailWrapper.toggleClass("protected", note.isProtected);
    $protectButton.toggleClass("active", note.isProtected);
    $unprotectButton.toggleClass("active", !note.isProtected);
    $unprotectButton.prop("disabled", !protectedSessionHolder.isProtectedSessionAvailable());
}

let isNewNoteCreated = false;

function newNoteCreated() {
    isNewNoteCreated = true;
}

async function handleProtectedSession() {
    const newSessionCreated = await protectedSessionService.ensureProtectedSession(currentNote.isProtected, false);

    if (currentNote.isProtected) {
        protectedSessionHolder.touchProtectedSession();
    }

    // this might be important if we focused on protected note when not in protected note and we got a dialog
    // to login, but we chose instead to come to another node - at that point the dialog is still visible and this will close it.
    protectedSessionService.ensureDialogIsClosed();

    return newSessionCreated;
}

async function loadNoteDetail(noteId) {
    currentNote = await loadNote(noteId);
    refreshAttributes(); // needs to happend after loading the note itself because it references current noteId

    if (isNewNoteCreated) {
        isNewNoteCreated = false;

        $noteTitle.focus().select();
    }

    $noteIdDisplay.html(noteId);

    setNoteBackgroundIfProtected(currentNote);

    $noteDetailWrapper.show();

    noteChangeDisabled = true;

    try {
        $noteTitle.val(currentNote.title);

        noteTypeService.setNoteType(currentNote.type);
        noteTypeService.setNoteMime(currentNote.mime);

        $noteDetailComponents.hide();

        const newSessionCreated = await handleProtectedSession();
        if (newSessionCreated) {
            // in such case we're reloading note anyway so no need to continue here.
            return;
        }

        await getComponent(currentNote.type).show();
    }
    finally {
        noteChangeDisabled = false;
    }

    treeService.setBranchBackgroundBasedOnProtectedStatus(noteId);

    // after loading new note make sure editor is scrolled to the top
    $noteDetailWrapper.scrollTop(0);

    $scriptArea.empty();

    await bundleService.executeRelationBundles(getCurrentNote(), 'runOnNoteView');

    await showAttributes();

    await showChildrenOverview();
}

async function showChildrenOverview() {
    const attributes = await attributePromise;
    const hideChildrenOverview = attributes.some(attr => attr.type === 'label' && attr.name === 'hideChildrenOverview');

    if (hideChildrenOverview) {
        $childrenOverview.hide();
        return;
    }

    const note = getCurrentNote();

    $childrenOverview.empty();

    const notePath = treeService.getCurrentNotePath();

    for (const childBranch of await note.getChildBranches()) {
        const link = $('<a>', {
            href: 'javascript:',
            text: await treeUtils.getNoteTitle(childBranch.noteId, childBranch.parentNoteId)
        }).attr('data-action', 'note').attr('data-note-path', notePath + '/' + childBranch.noteId);

        const childEl = $('<div class="child-overview">').html(link);
        $childrenOverview.append(childEl);
    }

    $childrenOverview.show();
}

async function refreshAttributes() {
    attributePromise = server.get('notes/' + getCurrentNoteId() + '/attributes');

    await showAttributes();
}

async function getAttributes() {
    return await attributePromise;
}

async function showAttributes() {
    $promotedAttributesContainer.empty();
    $attributeList.hide();

    const noteId = getCurrentNoteId();

    const attributes = await attributePromise;

    const promoted = attributes.filter(attr =>
        (attr.type === 'label-definition' || attr.type === 'relation-definition')
        && !attr.name.startsWith("child:")
        && attr.value.isPromoted);

    let idx = 1;

    async function createRow(definitionAttr, valueAttr) {
        const definition = definitionAttr.value;
        const inputId = "promoted-input-" + idx;
        const $tr = $("<tr>");
        const $labelCell = $("<th>").append(valueAttr.name);
        const $input = $("<input>")
            .prop("id", inputId)
            .prop("tabindex", definitionAttr.position)
            .prop("attribute-id", valueAttr.isOwned ? valueAttr.attributeId : '') // if not owned, we'll force creation of a new attribute instead of updating the inherited one
            .prop("attribute-type", valueAttr.type)
            .prop("attribute-name", valueAttr.name)
            .prop("value", valueAttr.value)
            .addClass("form-control")
            .addClass("promoted-attribute-input")
            .change(promotedAttributeChanged);

        idx++;

        const $inputCell = $("<td>").append($("<div>").addClass("input-group").append($input));

        const $actionCell = $("<td>");
        const $multiplicityCell = $("<td>");

        $tr
            .append($labelCell)
            .append($inputCell)
            .append($actionCell)
            .append($multiplicityCell);

        if (valueAttr.type === 'label') {
            if (definition.labelType === 'text') {
                $input.prop("type", "text");

                // no need to await for this, can be done asynchronously
                server.get('attributes/values/' + encodeURIComponent(valueAttr.name)).then(attributeValues => {
                    if (attributeValues.length === 0) {
                        return;
                    }

                    $input.autocomplete({
                        // shouldn't be required and autocomplete should just accept array of strings, but that fails
                        // because we have overriden filter() function in autocomplete.js
                        source: attributeValues.map(attribute => {
                            return {
                                attribute: attribute,
                                value: attribute
                            }
                        }),
                        minLength: 0
                    });

                    $input.focus(() => $input.autocomplete("search", ""));
                });
            }
            else if (definition.labelType === 'number') {
                $input.prop("type", "number");
            }
            else if (definition.labelType === 'boolean') {
                $input.prop("type", "checkbox");

                if (valueAttr.value === "true") {
                    $input.prop("checked", "checked");
                }
            }
            else if (definition.labelType === 'date') {
                $input.prop("type", "text");

                $input.datepicker({
                    changeMonth: true,
                    changeYear: true,
                    yearRange: "c-200:c+10",
                    dateFormat: "yy-mm-dd"
                });

                const $todayButton = $("<button>").addClass("btn btn-small").text("Today").click(() => {
                    $input.val(utils.formatDateISO(new Date()));
                    $input.trigger("change");
                });

                $actionCell.append($todayButton);
            }
            else if (definition.labelType === 'url') {
                $input.prop("placeholder", "http://website...");

                const $openButton = $("<button>").addClass("btn btn-small").text("Open").click(() => {
                    window.open($input.val(), '_blank');
                });

                $actionCell.append($openButton);
            }
            else {
                messagingService.logError("Unknown labelType=" + definitionAttr.labelType);
            }
        }
        else if (valueAttr.type === 'relation') {
            if (valueAttr.value) {
                $input.val((await treeUtils.getNoteTitle(valueAttr.value) + " (" + valueAttr.value + ")"));
            }

            // no need to wait for this
            noteAutocompleteService.initNoteAutocomplete($input);

            // ideally we'd use link instead of button which would allow tooltip preview, but
            // we can't guarantee updating the link in the a element
            const $openButton = $("<button>").addClass("btn btn-small").text("Open").click(() => {
                const notePath = linkService.getNotePathFromLabel($input.val());

                treeService.activateNote(notePath);
            });

            $actionCell.append($openButton);
        }
        else {
            messagingService.logError("Unknown attribute type=" + valueAttr.type);
            return;
        }

        if (definition.multiplicityType === "multivalue") {
            const addButton = $("<span>")
                .addClass("glyphicon glyphicon-plus pointer")
                .prop("title", "Add new attribute")
                .click(async () => {
                const $new = await createRow(definitionAttr, {
                    attributeId: "",
                    type: valueAttr.type,
                    name: definitionAttr.name,
                    value: ""
                });

                $tr.after($new);

                $new.find('input').focus();
            });

            const removeButton = $("<span>")
                .addClass("glyphicon glyphicon-trash pointer")
                .prop("title", "Remove this attribute")
                .click(async () => {
                if (valueAttr.attributeId) {
                    await server.remove("notes/" + noteId + "/attributes/" + valueAttr.attributeId);
                }

                $tr.remove();
            });

            $multiplicityCell.append(addButton).append(" &nbsp; ").append(removeButton);
        }

        return $tr;
    }

    if (promoted.length > 0) {
        const $tbody = $("<tbody>");

        for (const definitionAttr of promoted) {
            const definitionType = definitionAttr.type;
            const valueType = definitionType.substr(0, definitionType.length - 11);

            let valueAttrs = attributes.filter(el => el.name === definitionAttr.name && el.type === valueType);

            if (valueAttrs.length === 0) {
                valueAttrs.push({
                    attributeId: "",
                    type: valueType,
                    name: definitionAttr.name,
                    value: ""
                });
            }

            if (definitionAttr.value.multiplicityType === 'singlevalue') {
                valueAttrs = valueAttrs.slice(0, 1);
            }

            for (const valueAttr of valueAttrs) {
                const $tr = await createRow(definitionAttr, valueAttr);

                $tbody.append($tr);
            }
        }

        // we replace the whole content in one step so there can't be any race conditions
        // (previously we saw promoted attributes doubling)
        $promotedAttributesContainer.empty().append($tbody);
    }
    else {
        $attributeListInner.empty();

        if (attributes.length > 0) {
            for (const attribute of attributes) {
                if (attribute.type === 'label') {
                    $attributeListInner.append(utils.formatLabel(attribute) + " ");
                }
                else if (attribute.type === 'relation') {
                    $attributeListInner.append(attribute.name + "=");
                    $attributeListInner.append(await linkService.createNoteLink(attribute.value));
                    $attributeListInner.append(" ");
                }
                else if (attribute.type === 'label-definition' || attribute.type === 'relation-definition') {
                    $attributeListInner.append(attribute.name + " definition ");
                }
                else {
                    messagingService.logError("Unknown attr type: " + attribute.type);
                }
            }

            $attributeList.show();
        }
    }

    return attributes;
}

async function promotedAttributeChanged(event) {
    const $attr = $(event.target);

    let value;

    if ($attr.prop("type") === "checkbox") {
        value = $attr.is(':checked') ? "true" : "false";
    }
    else if ($attr.prop("attribute-type") === "relation") {
        if ($attr.val()) {
            value = treeUtils.getNoteIdFromNotePath(linkService.getNotePathFromLabel($attr.val()));
        }
    }
    else {
        value = $attr.val();
    }

    const result = await server.put("notes/" + getCurrentNoteId() + "/attribute", {
        attributeId: $attr.prop("attribute-id"),
        type: $attr.prop("attribute-type"),
        name: $attr.prop("attribute-name"),
        value: value
    });

    $attr.prop("attribute-id", result.attributeId);

    infoService.showMessage("Attribute has been saved.");
}

async function loadNote(noteId) {
    const row = await server.get('notes/' + noteId);

    return new NoteFull(treeCache, row);
}

function focus() {
    const note = getCurrentNote();

    getComponent(note.type).focus();
}

messagingService.subscribeToSyncMessages(syncData => {
    if (syncData.some(sync => sync.entityName === 'notes' && sync.entityId === getCurrentNoteId())) {
        infoService.showMessage('Reloading note because of background changes');

        reload();
    }
});

$(document).ready(() => {
    $noteTitle.on('input', () => {
        noteChanged();

        const title = $noteTitle.val();

        treeService.setNoteTitle(getCurrentNoteId(), title);
    });

    noteDetailText.focus();
});

// this makes sure that when user e.g. reloads the page or navigates away from the page, the note's content is saved
// this sends the request asynchronously and doesn't wait for result
$(window).on('beforeunload', () => { saveNoteIfChanged(); }); // don't convert to short form, handler doesn't like returned promise

setInterval(saveNoteIfChanged, 5000);

export default {
    reload,
    switchToNote,
    setNoteBackgroundIfProtected,
    loadNote,
    getCurrentNote,
    getCurrentNoteType,
    getCurrentNoteId,
    newNoteCreated,
    focus,
    getAttributes,
    showAttributes,
    refreshAttributes,
    saveNote,
    saveNoteIfChanged,
    noteChanged
};