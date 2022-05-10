import utils from '../services/utils.js';
import server from '../services/server.js';
import toastService from "../services/toast.js";
import appContext from "../services/app_context.js";
import libraryLoader from "../services/library_loader.js";
import openService from "../services/open.js";

const $dialog = $("#note-revisions-dialog");
const $list = $("#note-revision-list");
const $listDropdown = $("#note-revision-list-dropdown");
const $content = $("#note-revision-content");
const $title = $("#note-revision-title");
const $titleButtons = $("#note-revision-title-buttons");
const $eraseAllRevisionsButton = $("#note-revisions-erase-all-revisions-button");

$listDropdown.dropdown();

$listDropdown.parent().on('hide.bs.dropdown', e => {
    // prevent closing dropdown by clicking outside
    if (e.clickEvent) {
        e.preventDefault();
    }
});

let revisionItems = [];
let note;
let noteRevisionId;

export async function showCurrentNoteRevisions() {
    await showNoteRevisionsDialog(appContext.tabManager.getActiveContextNoteId());
}

export async function showNoteRevisionsDialog(noteId, noteRevisionId) {
    utils.openDialog($dialog);

    await loadNoteRevisions(noteId, noteRevisionId);
}

async function loadNoteRevisions(noteId, noteRevId) {
    $list.empty();
    $content.empty();
    $titleButtons.empty();

    note = appContext.tabManager.getActiveContextNote();
    revisionItems = await server.get(`notes/${noteId}/revisions`);

    for (const item of revisionItems) {
        $list.append(
            $('<a class="dropdown-item" tabindex="0">')
                .text(item.dateLastEdited.substr(0, 16) + ` (${item.contentLength} bytes)`)
                .attr('data-note-revision-id', item.noteRevisionId)
                .attr('title', 'This revision was last edited on ' + item.dateLastEdited)
        );
    }

    $listDropdown.dropdown('show');

    noteRevisionId = noteRevId;

    if (revisionItems.length > 0) {
        if (!noteRevisionId) {
            noteRevisionId = revisionItems[0].noteRevisionId;
        }
    } else {
        $title.text("No revisions for this note yet...");
        noteRevisionId = null;
    }

    $eraseAllRevisionsButton.toggle(revisionItems.length > 0);
}

$dialog.on('shown.bs.modal', () => {
    $list.find(`[data-note-revision-id="${noteRevisionId}"]`)
        .trigger('focus');
});

async function setContentPane() {
    const noteRevisionId = $list.find(".active").attr('data-note-revision-id');

    const revisionItem = revisionItems.find(r => r.noteRevisionId === noteRevisionId);

    $titleButtons.empty();
    $content.empty();

    $title.html(revisionItem.title);

    const $restoreRevisionButton = $('<button class="btn btn-sm" type="button">Restore this revision</button>');

    $restoreRevisionButton.on('click', async () => {
        const confirmDialog = await import('../dialogs/confirm.js');
        const text = 'Do you want to restore this revision? This will overwrite current title/content of the note with this revision.';

        if (await confirmDialog.confirm(text)) {
            await server.put(`notes/${revisionItem.noteId}/restore-revision/${revisionItem.noteRevisionId}`);

            $dialog.modal('hide');

            toastService.showMessage('Note revision has been restored.');
        }
    });

    const $eraseRevisionButton = $('<button class="btn btn-sm" type="button">Delete this revision</button>');

    $eraseRevisionButton.on('click', async () => {
        const confirmDialog = await import('../dialogs/confirm.js');
        const text = 'Do you want to delete this revision? This action will delete revision title and content, but still preserve revision metadata.';

        if (await confirmDialog.confirm(text)) {
            await server.remove(`notes/${revisionItem.noteId}/revisions/${revisionItem.noteRevisionId}`);

            loadNoteRevisions(revisionItem.noteId);

            toastService.showMessage('Note revision has been deleted.');
        }
    });

    $titleButtons
        .append($restoreRevisionButton)
        .append(' &nbsp; ')
        .append($eraseRevisionButton)
        .append(' &nbsp; ');

    const $downloadButton = $('<button class="btn btn-sm btn-primary" type="button">Download</button>');

    $downloadButton.on('click', () => openService.downloadNoteRevision(revisionItem.noteId, revisionItem.noteRevisionId));

    $titleButtons.append($downloadButton);

    const fullNoteRevision = await server.get(`notes/${revisionItem.noteId}/revisions/${revisionItem.noteRevisionId}`);

    if (revisionItem.type === 'text') {
        $content.html(fullNoteRevision.content);

        if ($content.find('span.math-tex').length > 0) {
            await libraryLoader.requireLibrary(libraryLoader.KATEX);

            renderMathInElement($content[0], {trust: true});
        }
    }
    else if (revisionItem.type === 'code') {
        $content.html($("<pre>").text(fullNoteRevision.content));
    }
    else if (revisionItem.type === 'image') {
        $content.html($("<img>")
            // reason why we put this inline as base64 is that we do not want to let user to copy this
            // as a URL to be used in a note. Instead if they copy and paste it into a note, it will be a uploaded as a new note
            .attr("src", `data:${note.mime};base64,` + fullNoteRevision.content)
            .css("max-width", "100%")
            .css("max-height", "100%"));
    }
    else if (revisionItem.type === 'file') {
        const $table = $("<table cellpadding='10'>")
            .append($("<tr>").append(
                $("<th>").text("MIME: "),
                $("<td>").text(revisionItem.mime)
            ))
            .append($("<tr>").append(
                $("<th>").text("File size:"),
                $("<td>").text(revisionItem.contentLength + " bytes")
            ));

        if (fullNoteRevision.content) {
            $table.append($("<tr>").append(
                $('<td colspan="2">').append(
                    $('<div style="font-weight: bold;">').text("Preview:"),
                    $('<pre class="file-preview-content"></pre>')
                        .text(fullNoteRevision.content)
                )
            ));
        }

        $content.html($table);
    }
    else if (revisionItem.type === 'canvas') {
        /**
         * FIXME: We load a font called Virgil.wof2, which originates from excalidraw.com
         *        REMOVE external dependency!!!! This is defined in the svg in defs.style
         */
        const content = fullNoteRevision.content;

        try {
            const data = JSON.parse(content)
            const svg = data.svg || "no svg present."

            /**
             * maxWidth: 100% use full width of container but do not enlarge!
             * height:auto to ensure that height scales with width
             */
            const $svgHtml = $(svg).css({maxWidth: "100%", height: "auto"});
            $content.html($('<div>').append($svgHtml));
        } catch(err) {
            console.error("error parsing fullNoteRevision.content as JSON", fullNoteRevision.content, err);
            $content.html($("<div>").text("Error parsing content. Please check console.error() for more details."));
        }
    }
    else {
        $content.text("Preview isn't available for this note type.");
    }
}

$eraseAllRevisionsButton.on('click', async () => {
    const confirmDialog = await import('../dialogs/confirm.js');
    const text = 'Do you want to delete all revisions of this note? This action will erase revision title and content, but still preserve revision metadata.';

    if (await confirmDialog.confirm(text)) {
        await server.remove(`notes/${note.noteId}/revisions`);

        $dialog.modal('hide');

        toastService.showMessage('Note revisions has been deleted.');
    }
});

$list.on('click', '.dropdown-item', e => {
   e.preventDefault();
   return false;
});

$list.on('focus', '.dropdown-item', e => {
    $list.find('.dropdown-item').each((i, el) => {
        $(el).toggleClass('active', el === e.target);
    });

    setContentPane();
});
