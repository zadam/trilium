import noteDetailService from "./note_detail.js";
import treeUtils from "./tree_utils.js";
import linkService from "./link.js";

function setupTooltip() {
    $(document).tooltip({
        items: "#note-detail a",
        content: function (callback) {
            const notePath = linkService.getNotePathFromLink($(this).attr("href"));

            if (notePath !== null) {
                const noteId = treeUtils.getNoteIdFromNotePath(notePath);

                noteDetailService.loadNote(noteId).then(note => callback(note.content));
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