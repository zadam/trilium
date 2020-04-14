import treeService from "../services/tree.js";
import utils from "../services/utils.js";
import ws from "../services/ws.js";
import toastService from "../services/toast.js";
import treeCache from "../services/tree_cache.js";

const $dialog = $("#export-dialog");
const $form = $("#export-form");
const $noteTitle = $dialog.find(".export-note-title");
const $subtreeFormats = $("#export-subtree-formats");
const $singleFormats = $("#export-single-formats");
const $subtreeType = $("#export-type-subtree");
const $singleType = $("#export-type-single");
const $exportButton = $("#export-button");
const $opmlVersions = $("#opml-versions");

let taskId = '';
let branchId = null;

export async function showDialog(notePath, defaultType) {
    // each opening of the dialog resets the taskId so we don't associate it with previous exports anymore
    taskId = '';
    $exportButton.removeAttr("disabled");

    if (defaultType === 'subtree') {
        $subtreeType.prop("checked", true).trigger('change');

        // to show/hide OPML versions
        $("input[name=export-subtree-format]:checked").trigger('change');
    }
    else if (defaultType === 'single') {
        $singleType.prop("checked", true).trigger('change');
    }
    else {
        throw new Error("Unrecognized type " + defaultType);
    }

    $("#opml-v2").prop("checked", true); // setting default

    utils.openDialog($dialog);

    const {noteId, parentNoteId} = treeService.getNoteIdAndParentIdFromNotePath(notePath);

    branchId = await treeCache.getBranchId(parentNoteId, noteId);

    const noteTitle = await treeService.getNoteTitle(noteId);

    $noteTitle.html(noteTitle);
}

$form.on('submit', () => {
    $dialog.modal('hide');

    const exportType = $dialog.find("input[name='export-type']:checked").val();

    if (!exportType) {
        // this shouldn't happen as we always choose default export type
        alert("Choose export type first please");
        return;
    }

    const exportFormat = exportType === 'subtree'
        ? $("input[name=export-subtree-format]:checked").val()
        : $("input[name=export-single-format]:checked").val();

    const exportVersion = exportFormat === 'opml' ? $dialog.find("input[name='opml-version']:checked").val() : "1.0";

    exportBranch(branchId, exportType, exportFormat, exportVersion);

    return false;
});

function exportBranch(branchId, type, format, version) {
    taskId = utils.randomString(10);

    const url = utils.getUrlForDownload(`api/notes/${branchId}/export/${type}/${format}/${version}/${taskId}`);

    utils.download(url);
}

$('input[name=export-type]').on('change', function () {
    if (this.value === 'subtree') {
        if ($("input[name=export-subtree-format]:checked").length === 0) {
            $("input[name=export-subtree-format]:first").prop("checked", true);
        }

        $subtreeFormats.slideDown();
        $singleFormats.slideUp();
    }
    else {
        if ($("input[name=export-single-format]:checked").length === 0) {
            $("input[name=export-single-format]:first").prop("checked", true);
        }

        $subtreeFormats.slideUp();
        $singleFormats.slideDown();
    }
});

$('input[name=export-subtree-format]').on('change', function () {
    if (this.value === 'opml') {
        $opmlVersions.slideDown();
    }
    else {
        $opmlVersions.slideUp();
    }
});

function makeToast(id, message) {
    return {
        id: id,
        title: "Export status",
        message: message,
        icon: "arrow-square-up-right"
    };
}

ws.subscribeToMessages(async message => {
    if (message.taskType !== 'export') {
        return;
    }

    if (message.type === 'task-error') {
        toastService.closePersistent(message.taskId);
        toastService.showError(message.message);
    }
    else if (message.type === 'task-progress-count') {
        toastService.showPersistent(makeToast(message.taskId, "Export in progress: " + message.progressCount));
    }
    else if (message.type === 'task-succeeded') {
        const toast = makeToast(message.taskId, "Import finished successfully.");
        toast.closeAfter = 5000;

        toastService.showPersistent(toast);
    }
});