import linkService from '../../services/link.js';
import utils from '../../services/utils.js';
import server from '../../services/server.js';
import treeService from "../../services/tree.js";
import froca from "../../services/froca.js";
import appContext from "../../services/app_context.js";
import hoistedNoteService from "../../services/hoisted_note.js";
import BasicWidget from "../basic_widget.js";
import dialogService from "../dialog.js";

const TPL = `
<div class="recent-changes-dialog modal fade mx-auto" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg modal-dialog-scrollable" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Recent changes</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
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
    }

    async showRecentChangesEvent({ancestorNoteId}) {
        await this.refresh(ancestorNoteId);

        utils.openDialog(this.$widget);
    }

    async refresh(ancestorNoteId) {
        if (!ancestorNoteId) {
            ancestorNoteId = hoistedNoteService.getHoistedNoteId();
        }

        const recentChangesRows = await server.get('recent-changes/' + ancestorNoteId);

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

                                    await froca.reloadNotes([change.noteId]);

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
                    const notePath = treeService.getSomeNotePath(note);

                    if (notePath) {
                        $noteLink = await linkService.createNoteLink(notePath, {
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
