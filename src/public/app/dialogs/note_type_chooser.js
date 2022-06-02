import noteTypesService from "../services/note_types.js";

const $dialog = $("#note-type-chooser-dialog");
const $noteTypeDropdown = $("#note-type-dropdown");
const $noteTypeDropdownTrigger = $("#note-type-dropdown-trigger");
$noteTypeDropdownTrigger.dropdown();

let resolve;
let $originalFocused; // element focused before the dialog was opened, so we can return to it afterwards
let $originalDialog;

export async function chooseNoteType() {
    $originalFocused = $(':focus');

    const noteTypes = await noteTypesService.getNoteTypeItems();

    $noteTypeDropdown.empty();

    for (const noteType of noteTypes) {
        if (noteType.title === '----') {
            $noteTypeDropdown.append($('<h6 class="dropdown-header">').append("Templates:"));
        }
        else {
            $noteTypeDropdown.append(
                $('<a class="dropdown-item" tabindex="0">')
                    .attr("data-note-type", noteType.type)
                    .attr("data-template-note-id", noteType.templateNoteId)
                    .append($("<span>").addClass(noteType.uiIcon))
                    .append(" " + noteType.title)
            );
        }
    }

    $noteTypeDropdownTrigger.dropdown('show');

    $originalDialog = glob.activeDialog;
    glob.activeDialog = $dialog;
    $dialog.modal();

    $noteTypeDropdown.find(".dropdown-item:first").focus();

    return new Promise((res, rej) => { resolve = res; });
}

$dialog.on("hidden.bs.modal", () => {
    if (resolve) {
        resolve({success: false});
    }

    if ($originalFocused) {
        $originalFocused.trigger('focus');
        $originalFocused = null;
    }

    glob.activeDialog = $originalDialog;
});

function doResolve(e) {
    const $item = $(e.target).closest(".dropdown-item");
    const noteType = $item.attr("data-note-type");
    const templateNoteId = $item.attr("data-template-note-id");

    resolve({
        success: true,
        noteType,
        templateNoteId
    });
    resolve = null;

    $dialog.modal("hide");
}

$noteTypeDropdown.on('click', '.dropdown-item', e => doResolve(e));

$noteTypeDropdown.on('focus', '.dropdown-item', e => {
    $noteTypeDropdown.find('.dropdown-item').each((i, el) => {
        $(el).toggleClass('active', el === e.target);
    });
});

$noteTypeDropdown.on('keydown', '.dropdown-item', e => {
    if (e.key === 'Enter') {
        doResolve(e);
        e.preventDefault();
        return false;
    }
});

$noteTypeDropdown.parent().on('hide.bs.dropdown', e => {
    // prevent closing dropdown by clicking outside
    if (e.clickEvent) {
        e.preventDefault();
    }
});
