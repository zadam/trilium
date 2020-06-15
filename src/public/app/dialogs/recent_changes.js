import linkService from '../services/link.js';
import utils from '../services/utils.js';
import server from '../services/server.js';
import treeService from "../services/tree.js";
import treeCache from "../services/tree_cache.js";
import appContext from "../services/app_context.js";
import hoistedNoteService from "../services/hoisted_note.js";

const $dialog = $("#recent-changes-dialog");
const $content = $("#recent-changes-content");

export async function showDialog(ancestorNoteId) {
    utils.openDialog($dialog);

    if (!ancestorNoteId) {
        ancestorNoteId = hoistedNoteService.getHoistedNoteId();
    }

    const recentChangesRows = await server.get('recent-changes/' + ancestorNoteId);

    // preload all notes into cache
    await treeCache.getNotes(recentChangesRows.map(r => r.noteId), true);

    $content.empty();

    if (recentChangesRows.length === 0) {
        $content.append("No changes yet ...");
    }

    const groupedByDate = groupByDate(recentChangesRows);

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
                            const confirmDialog = await import('../dialogs/confirm.js');
                            const text = 'Do you want to undelete this note and its sub-notes?';

                            if (await confirmDialog.confirm(text)) {
                                await server.put(`notes/${change.noteId}/undelete`);

                                $dialog.modal('hide');

                                await treeCache.reloadNotes([change.noteId]);

                                appContext.tabManager.getActiveTabContext().setNote(change.noteId);
                            }
                        });

                    $noteLink
                        .append(' (')
                        .append($undeleteLink)
                        .append(')');
                }
            }
            else {
                const note = await treeCache.getNote(change.noteId);
                const notePath = await treeService.getSomeNotePath(note);

                if (notePath) {
                    $noteLink = await linkService.createNoteLink(notePath, {
                        title: change.title,
                        showNotePath: true
                    });
                }
                else {
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

        $content.append(dayEl);
    }
}

function groupByDate(rows) {
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
