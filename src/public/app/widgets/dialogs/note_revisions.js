import utils from '../../services/utils.js';
import server from '../../services/server.js';
import toastService from "../../services/toast.js";
import appContext from "../../components/app_context.js";
import libraryLoader from "../../services/library_loader.js";
import openService from "../../services/open.js";
import protectedSessionHolder from "../../services/protected_session_holder.js";
import BasicWidget from "../basic_widget.js";
import dialogService from "../../services/dialog.js";

const TPL = `
<div class="note-revisions-dialog modal fade mx-auto" tabindex="-1" role="dialog">
    <style>
        .note-revisions-dialog .note-revision-content-wrapper {
            flex-grow: 1;
            margin-left: 20px;
            display: flex;
            flex-direction: column;
            min-width: 0;
        }

        .note-revisions-dialog .note-revision-content {
            overflow: auto;
            word-break: break-word;
        }

        .note-revisions-dialog .note-revision-content img {
            max-width: 100%;
            object-fit: contain;
        }

        .note-revisions-dialog .note-revision-content pre {
            max-width: 100%;
            word-break: break-all;
            white-space: pre-wrap;
        }
    </style>

    <div class="modal-dialog modal-xl" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title mr-auto">Note revisions</h5>

                <button class="note-revisions-erase-all-revisions-button btn btn-xs"
                        title="Delete all revisions of this note"
                        style="padding: 0 10px 0 10px;" type="button">Delete all revisions</button>

                <button class="help-button" type="button" data-help-page="Note-revisions" title="Help on Note revisions">?</button>

                <button type="button" class="close" data-dismiss="modal" aria-label="Close" style="margin-left: 0 !important;">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body" style="display: flex; height: 80vh;">
                <div class="dropdown">
                    <button class="note-revision-list-dropdown" type="button" style="display: none;" data-toggle="dropdown">Dropdown trigger</button>

                    <div class="note-revision-list dropdown-menu" style="position: static; height: 100%; overflow: auto;"></div>
                </div>

                <div class="note-revision-content-wrapper">
                    <div style="flex-grow: 0; display: flex; justify-content: space-between;">
                        <h3 class="note-revision-title" style="margin: 3px; flex-grow: 100;"></h3>

                        <div class="note-revision-title-buttons"></div>
                    </div>

                    <div class="note-revision-content"></div>
                </div>
            </div>
        </div>
    </div>
</div>`;

export default class NoteRevisionsDialog extends BasicWidget {
    constructor() {
        super();

        this.revisionItems = [];
        this.note = null;
        this.noteRevisionId = null;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$list = this.$widget.find(".note-revision-list");
        this.$listDropdown = this.$widget.find(".note-revision-list-dropdown");
        this.$content = this.$widget.find(".note-revision-content");
        this.$title = this.$widget.find(".note-revision-title");
        this.$titleButtons = this.$widget.find(".note-revision-title-buttons");
        this.$eraseAllRevisionsButton = this.$widget.find(".note-revisions-erase-all-revisions-button");

        this.$listDropdown.dropdown();

        this.$listDropdown.parent().on('hide.bs.dropdown', e => {
            // prevent closing dropdown by clicking outside
            if (e.clickEvent) {
                e.preventDefault();
            }
        });

        this.$widget.on('shown.bs.modal', () => {
            this.$list.find(`[data-note-revision-id="${this.noteRevisionId}"]`)
                .trigger('focus');
        });

        this.$eraseAllRevisionsButton.on('click', async () => {
            const text = 'Do you want to delete all revisions of this note? This action will erase revision title and content, but still preserve revision metadata.';

            if (await dialogService.confirm(text)) {
                await server.remove(`notes/${this.note.noteId}/revisions`);

                this.$widget.modal('hide');

                toastService.showMessage('Note revisions has been deleted.');
            }
        });

        this.$list.on('click', '.dropdown-item', e => {
            e.preventDefault();
            return false;
        });

        this.$list.on('focus', '.dropdown-item', e => {
            this.$list.find('.dropdown-item').each((i, el) => {
                $(el).toggleClass('active', el === e.target);
            });

            this.setContentPane();
        });
    }

    async showNoteRevisionsEvent({noteId = appContext.tabManager.getActiveContextNoteId()}) {
        utils.openDialog(this.$widget);

        await this.loadNoteRevisions(noteId);
    }

    async loadNoteRevisions(noteId) {
        this.$list.empty();
        this.$content.empty();
        this.$titleButtons.empty();

        this.note = appContext.tabManager.getActiveContextNote();
        this.revisionItems = await server.get(`notes/${noteId}/revisions`);

        for (const item of this.revisionItems) {
            this.$list.append(
                $('<a class="dropdown-item" tabindex="0">')
                    .text(`${item.dateLastEdited.substr(0, 16)} (${item.contentLength} bytes)`)
                    .attr('data-note-revision-id', item.noteRevisionId)
                    .attr('title', `This revision was last edited on ${item.dateLastEdited}`)
            );
        }

        this.$listDropdown.dropdown('show');

        if (this.revisionItems.length > 0) {
            if (!this.noteRevisionId) {
                this.noteRevisionId = this.revisionItems[0].noteRevisionId;
            }
        } else {
            this.$title.text("No revisions for this note yet...");
            this.noteRevisionId = null;
        }

        this.$eraseAllRevisionsButton.toggle(this.revisionItems.length > 0);
    }

    async setContentPane() {
        const noteRevisionId = this.$list.find(".active").attr('data-note-revision-id');

        const revisionItem = this.revisionItems.find(r => r.noteRevisionId === noteRevisionId);

        this.$titleButtons.empty();
        this.$content.empty();

        this.$title.html(revisionItem.title);

        const $restoreRevisionButton = $('<button class="btn btn-sm" type="button">Restore this revision</button>');

        $restoreRevisionButton.on('click', async () => {
            const text = 'Do you want to restore this revision? This will overwrite current title/content of the note with this revision.';

            if (await dialogService.confirm(text)) {
                await server.put(`notes/${revisionItem.noteId}/restore-revision/${revisionItem.noteRevisionId}`);

                this.$widget.modal('hide');

                toastService.showMessage('Note revision has been restored.');
            }
        });

        const $eraseRevisionButton = $('<button class="btn btn-sm" type="button">Delete this revision</button>');

        $eraseRevisionButton.on('click', async () => {
            const text = 'Do you want to delete this revision? This action will delete revision title and content, but still preserve revision metadata.';

            if (await dialogService.confirm(text)) {
                await server.remove(`notes/${revisionItem.noteId}/revisions/${revisionItem.noteRevisionId}`);

                this.loadNoteRevisions(revisionItem.noteId);

                toastService.showMessage('Note revision has been deleted.');
            }
        });

        if (!revisionItem.isProtected || protectedSessionHolder.isProtectedSessionAvailable()) {
            this.$titleButtons
                .append($restoreRevisionButton)
                .append(' &nbsp; ');
        }

        this.$titleButtons
            .append($eraseRevisionButton)
            .append(' &nbsp; ');

        const $downloadButton = $('<button class="btn btn-sm btn-primary" type="button">Download</button>');

        $downloadButton.on('click', () => openService.downloadNoteRevision(revisionItem.noteId, revisionItem.noteRevisionId));

        if (!revisionItem.isProtected || protectedSessionHolder.isProtectedSessionAvailable()) {
            this.$titleButtons.append($downloadButton);
        }

        const fullNoteRevision = await server.get(`notes/${revisionItem.noteId}/revisions/${revisionItem.noteRevisionId}`);

        if (revisionItem.type === 'text') {
            this.$content.html(fullNoteRevision.content);

            if (this.$content.find('span.math-tex').length > 0) {
                await libraryLoader.requireLibrary(libraryLoader.KATEX);

                renderMathInElement($content[0], {trust: true});
            }
        }
        else if (revisionItem.type === 'code' || revisionItem.type === 'mermaid') {
            this.$content.html($("<pre>").text(fullNoteRevision.content));
        }
        else if (revisionItem.type === 'image') {
            this.$content.html($("<img>")
                // reason why we put this inline as base64 is that we do not want to let user to copy this
                // as a URL to be used in a note. Instead, if they copy and paste it into a note, it will be a uploaded as a new note
                .attr("src", `data:${fullNoteRevision.mime};base64,${fullNoteRevision.content}`)
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
                    $("<td>").text(`${revisionItem.contentLength} bytes`)
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

            this.$content.html($table);
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
                this.$content.html($('<div>').append($svgHtml));
            } catch(err) {
                console.error("error parsing fullNoteRevision.content as JSON", fullNoteRevision.content, err);
                this.$content.html($("<div>").text("Error parsing content. Please check console.error() for more details."));
            }
        }
        else {
            this.$content.text("Preview isn't available for this note type.");
        }
    }
}
