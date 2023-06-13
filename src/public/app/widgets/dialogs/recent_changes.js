import linkService from '../../services/link.js';
import utils from '../../services/utils.js';
import server from '../../services/server.js';
import froca from "../../services/froca.js";
import appContext from "../../components/app_context.js";
import hoistedNoteService from "../../services/hoisted_note.js";
import BasicWidget from "../basic_widget.js";
import dialogService from "../../services/dialog.js";
import toastService from "../../services/toast.js";
import ws from "../../services/ws.js";

const TPL = `
<div class="recent-changes-dialog modal fade mx-auto" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg modal-dialog-scrollable" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title mr-auto">Recent changes</h5>
                
                <button class="erase-deleted-notes-now-button btn btn-sm" style="padding: 0 10px">
                    Erase deleted notes now</button>
                
                <button type="button" class="close" data-dismiss="modal" aria-label="Close" style="margin-left: 0 !important;">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <div class="recent-changes-content"></div>
            </div>
        </div>
    </div>
</div>`;

export default class RecentChangesDialog extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$content = this.$widget.find(".recent-changes-content");
        this.$eraseDeletedNotesNow = this.$widget.find(".erase-deleted-notes-now-button");
        this.$eraseDeletedNotesNow.on("click", () => {
            server.post('notes/erase-deleted-notes-now').then(() => {
                this.refresh();

                toastService.showMessage("Deleted notes have been erased.");
            });
        });
    }

    async showRecentChangesEvent({ancestorNoteId}) {
        this.ancestorNoteId = ancestorNoteId;

        await this.refresh();

        utils.openDialog(this.$widget);
    }

    async refresh() {
        if (!this.ancestorNoteId) {
            this.ancestorNoteId = hoistedNoteService.getHoistedNoteId();
        }

        const recentChangesRows = await server.get(`recent-changes/${this.ancestorNoteId}`);

        // preload all notes into cache
        await froca.getNotes(recentChangesRows.map(r => r.noteId), true);

        this.$content.empty();

        if (recentChangesRows.length === 0) {
            this.$content.append("No changes yet ...");
        }

        const groupedByDate = this.groupByDate(recentChangesRows);

        for (const [dateDay, dayChanges] of groupedByDate) {
            const $changesList = $('<ul>');

            const dayEl = $('<div>').append($('<b>').text(dateDay)).append($changesList);

            for (const change of dayChanges) {
                const formattedTime = change.date.substr(11, 5);

                let $noteLink;

                if (change.current_isDeleted) {
                    $noteLink = $("<span>").text(change.current_title);

                    if (change.canBeUndeleted) {
                        const $undeleteLink = $(`<a href="javascript:">`)
                            .text("undelete")
                            .on('click', async () => {
                                const text = 'Do you want to undelete this note and its sub-notes?';

                                if (await dialogService.confirm(text)) {
                                    await server.put(`notes/${change.noteId}/undelete`);

                                    this.$widget.modal('hide');

                                    await ws.waitForMaxKnownEntityChangeId();

                                    appContext.tabManager.getActiveContext().setNote(change.noteId);
                                }
                            });

                        $noteLink
                            .append(' (')
                            .append($undeleteLink)
                            .append(')');
                    }
                } else {
                    const note = await froca.getNote(change.noteId);
                    const notePath = note.getBestNotePathString();

                    if (notePath) {
                        $noteLink = await linkService.createLink(notePath, {
                            title: change.title,
                            showNotePath: true
                        });
                    } else {
                        $noteLink = $("<span>").text(note.title);
                    }
                }

                $changesList.append($('<li>')
                    .append(
                        $("<span>")
                            .text(formattedTime)
                            .attr("title", change.date)
                    )
                    .append(' - ')
                    .append($noteLink));
            }

            this.$content.append(dayEl);
        }
    }

    groupByDate(rows) {
        const groupedByDate = new Map();

        for (const row of rows) {
            const dateDay = row.date.substr(0, 10);

            if (!groupedByDate.has(dateDay)) {
                groupedByDate.set(dateDay, []);
            }

            groupedByDate.get(dateDay).push(row);
        }

        return groupedByDate;
    }
}
