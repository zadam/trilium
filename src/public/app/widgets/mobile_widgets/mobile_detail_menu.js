import BasicWidget from "../basic_widget.js";
import appContext from "../../services/app_context.js";
import contextMenu from "../../services/context_menu.js";
import noteCreateService from "../../services/note_create.js";
import branchService from "../../services/branches.js";

const TPL = `<button type="button" class="action-button bx bx-menu"></button>`;

class MobileDetailMenuWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$widget.on("click", async e => {
            const note = appContext.tabManager.getActiveTabNote();

            contextMenu.show({
                x: e.pageX,
                y: e.pageY,
                items: [
                    { title: "Insert child note", command: "insertChildNote", uiIcon: "plus",
                        enabled: note.type !== 'search' },
                    { title: "Delete this note", command: "delete", uiIcon: "trash",
                        enabled: note.noteId !== 'root' }
                ],
                selectMenuItemHandler: async ({command}) => {
                    if (command === "insertChildNote") {
                        noteCreateService.createNote(note.noteId);
                    }
                    else if (command === "delete") {
                        if (await branchService.deleteNotes(note.getBranchIds()[0])) {
                            // move to the tree
                            togglePanes();
                        }
                    }
                    else {
                        throw new Error("Unrecognized command " + command);
                    }
                }
            });
        });

        return this.$widget;
    }
}

export default MobileDetailMenuWidget;