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
<div class="revisions-dialog modal fade mx-auto" tabindex="-1" role="dialog">
    <style>
        .revisions-dialog .revision-content-wrapper {
            flex-grow: 1;
            margin-left: 20px;
            display: flex;
            flex-direction: column;
            min-width: 0;
        }

        .revisions-dialog .revision-content {
            overflow: auto;
            word-break: break-word;
        }

        .revisions-dialog .revision-content img {
            max-width: 100%;
            object-fit: contain;
        }

        .revisions-dialog .revision-content pre {
            max-width: 100%;
            word-break: break-all;
            white-space: pre-wrap;
        }
    </style>

    <div class="modal-dialog modal-xl" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title mr-auto">Note revisions</h5>

                <button class="revisions-erase-all-revisions-button btn btn-sm"
                        title="Delete all revisions of this note"
                        style="padding: 0 10px 0 10px;" type="button">Delete all revisions</button>

                <button class="help-button" type="button" data-help-page="Note-revisions" title="Help on Note revisions">?</button>

                <button type="button" class="close" data-dismiss="modal" aria-label="Close" style="margin-left: 0 !important;">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body" style="display: flex; height: 80vh;">
                <div class="dropdown">
                    <button class="revision-list-dropdown" type="button" style="display: none;" data-toggle="dropdown">Dropdown trigger</button>

                    <div class="revision-list dropdown-menu" style="position: static; height: 100%; overflow: auto;"></div>
                </div>

                <div class="revision-content-wrapper">
                    <div style="flex-grow: 0; display: flex; justify-content: space-between;">
                        <h3 class="revision-title" style="margin: 3px; flex-grow: 100;"></h3>

                        <div class="revision-title-buttons"></div>
                    </div>

                    <div class="revision-content"></div>
                </div>
            </div>
        </div>
    </div>
</div>`;

export default class RevisionsDialog extends BasicWidget {
    constructor() {
        super();

        this.revisionItems = [];
        this.note = null;
        this.revisionId = null;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$list = this.$widget.find(".revision-list");
        this.$listDropdown = this.$widget.find(".revision-list-dropdown");
        this.$content = this.$widget.find(".revision-content");
        this.$title = this.$widget.find(".revision-title");
        this.$titleButtons = this.$widget.find(".revision-title-buttons");
        this.$eraseAllRevisionsButton = this.$widget.find(".revisions-erase-all-revisions-button");

        this.$listDropdown.dropdown();

        this.$listDropdown.parent().on('hide.bs.dropdown', e => {
            // prevent closing dropdown by clicking outside
            if (e.clickEvent) {
                e.preventDefault();
            }
        });

        this.$widget.on('shown.bs.modal', () => {
            this.$list.find(`[data-revision-id="${this.revisionId}"]`)
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

    async showRevisionsEvent({noteId = appContext.tabManager.getActiveContextNoteId()}) {
        utils.openDialog(this.$widget);

        await this.loadRevisions(noteId);
    }

    async loadRevisions(noteId) {
        this.$list.empty();
        this.$content.empty();
        this.$titleButtons.empty();

        this.note = appContext.tabManager.getActiveContextNote();
        this.revisionItems = await server.get(`notes/${noteId}/revisions`);

        for (const item of this.revisionItems) {
            this.$list.append(
                $('<a class="dropdown-item" tabindex="0">')
                    .text(`${item.dateLastEdited.substr(0, 16)} (${utils.formatSize(item.contentLength)})`)
                    .attr('data-revision-id', item.revisionId)
                    .attr('title', `This revision was last edited on ${item.dateLastEdited}`)
            );
        }

        this.$listDropdown.dropdown('show');

        if (this.revisionItems.length > 0) {
            if (!this.revisionId) {
                this.revisionId = this.revisionItems[0].revisionId;
            }
        } else {
            this.$title.text("No revisions for this note yet...");
            this.revisionId = null;
        }

        this.$eraseAllRevisionsButton.toggle(this.revisionItems.length > 0);
    }

    async setContentPane() {
        const revisionId = this.$list.find(".active").attr('data-revision-id');

        const revisionItem = this.revisionItems.find(r => r.revisionId === revisionId);

        this.$title.html(revisionItem.title);

        this.renderContentButtons(revisionItem);

        await this.renderContent(revisionItem);
    }

    renderContentButtons(revisionItem) {
        this.$titleButtons.empty();

        const $restoreRevisionButton = $('<button class="btn btn-sm" type="button">Restore this revision</button>');

        $restoreRevisionButton.on('click', async () => {
            const text = 'Do you want to restore this revision? This will overwrite current title/content of the note with this revision.';

            if (await dialogService.confirm(text)) {
                await server.post(`revisions/${revisionItem.revisionId}/restore`);

                this.$widget.modal('hide');

                toastService.showMessage('Note revision has been restored.');
            }
        });

        const $eraseRevisionButton = $('<button class="btn btn-sm" type="button">Delete this revision</button>');

        $eraseRevisionButton.on('click', async () => {
            const text = 'Do you want to delete this revision? This action will delete revision title and content, but still preserve revision metadata.';

            if (await dialogService.confirm(text)) {
                await server.remove(`revisions/${revisionItem.revisionId}`);

                this.loadRevisions(revisionItem.noteId);

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

        $downloadButton.on('click', () => openService.downloadRevision(revisionItem.noteId, revisionItem.revisionId));

        if (!revisionItem.isProtected || protectedSessionHolder.isProtectedSessionAvailable()) {
            this.$titleButtons.append($downloadButton);
        }
    }

    async renderContent(revisionItem) {
        this.$content.empty();

        const fullRevision = await server.get(`revisions/${revisionItem.revisionId}`);

        if (revisionItem.type === 'text') {
            this.$content.html(fullRevision.content);

            if (this.$content.find('span.math-tex').length > 0) {
                await libraryLoader.requireLibrary(libraryLoader.KATEX);

                renderMathInElement(this.$content[0], {trust: true});
            }
        } else if (revisionItem.type === 'code') {
            this.$content.html($("<pre>").text(fullRevision.content));
        } else if (revisionItem.type === 'image') {
            this.$content.html($("<img>")
                // the reason why we put this inline as base64 is that we do not want to let user copy this
                // as a URL to be used in a note. Instead, if they copy and paste it into a note, it will be uploaded as a new note
                .attr("src", `data:${fullRevision.mime};base64,${fullRevision.content}`)
                .css("max-width", "100%")
                .css("max-height", "100%"));
        } else if (revisionItem.type === 'file') {
            const $table = $("<table cellpadding='10'>")
                .append($("<tr>").append(
                    $("<th>").text("MIME: "),
                    $("<td>").text(revisionItem.mime)
                ))
                .append($("<tr>").append(
                    $("<th>").text("File size:"),
                    $("<td>").text(utils.formatSize(revisionItem.contentLength))
                ));

            if (fullRevision.content) {
                $table.append($("<tr>").append(
                    $('<td colspan="2">').append(
                        $('<div style="font-weight: bold;">').text("Preview:"),
                        $('<pre class="file-preview-content"></pre>')
                            .text(fullRevision.content)
                    )
                ));
            }

            this.$content.html($table);
        } else if (revisionItem.type === 'canvas') {
            const encodedTitle = encodeURIComponent(revisionItem.title);

            this.$content.html($("<img>")
                .attr("src", `api/revisions/${revisionItem.revisionId}/image/${encodedTitle}?${Math.random()}`)
                .css("max-width", "100%"));
        } else if (revisionItem.type === 'mermaid') {
            const encodedTitle = encodeURIComponent(revisionItem.title);

            this.$content.html($("<img>")
                .attr("src", `api/revisions/${revisionItem.revisionId}/image/${encodedTitle}?${Math.random()}`)
                .css("max-width", "100%"));

            this.$content.append($("<pre>").text(fullRevision.content));
        } else {
            this.$content.text("Preview isn't available for this note type.");
        }
    }
}
