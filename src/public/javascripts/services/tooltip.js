import noteDetailService from "./note_detail.js";
import treeUtils from "./tree_utils.js";
import linkService from "./link.js";

function setupTooltip() {
    $(document).tooltip({
        items: "#note-detail-wrapper a",
        content: function (callback) {
            let notePath = linkService.getNotePathFromLink($(this).attr("href"));

            if (!notePath) {
                notePath = $(this).attr("note-path");
            }

            if (notePath) {
                const noteId = treeUtils.getNoteIdFromNotePath(notePath);

                noteDetailService.loadNote(noteId).then(note => {
                    if (!note.content.trim()) {
                        return;
                    }

                    if (note.type === 'text') {
                        callback(note.content);
                    }
                    else if (note.type === 'code') {console.log($("<pre>").text(note.content).html());
                        callback($("<pre>").text(note.content).prop('outerHTML'));
                    }
                    // other types of notes don't have tooltip preview
                });
            }
        },
        close: function (event, ui) {
            ui.tooltip.hover(function () {
                    $(this).stop(true).fadeTo(400, 1);
                },
                function () {
                    $(this).fadeOut('400', function () {
                        $(this).remove();
                    });
                });
        }
    });
}

export default {
    setupTooltip
}