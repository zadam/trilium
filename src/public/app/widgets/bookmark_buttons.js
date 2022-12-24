import FlexContainer from "./containers/flex_container.js";
import OpenNoteButtonWidget from "./buttons/open_note_button_widget.js";
import BookmarkFolderWidget from "./buttons/bookmark_folder.js";
import froca from "../services/froca.js";

export default class BookmarkButtons extends FlexContainer {
    constructor() {
        super("column");

        this.contentSized();
    }

    async refresh() {
        this.$widget.empty();
        this.children = [];
        this.noteIds = [];

        const bookmarkParentNote = await froca.getNote('_lbBookmarks');

        for (const note of await bookmarkParentNote.getChildNotes()) {
            this.noteIds.push(note.noteId);

            const buttonWidget = note.hasLabel("bookmarkFolder")
                ? new BookmarkFolderWidget(note)
                : new OpenNoteButtonWidget(note)
                    .class("launcher-button");

            this.child(buttonWidget);

            this.$widget.append(buttonWidget.render());

            buttonWidget.refreshIcon();
        }
    }

    initialRenderCompleteEvent() {
        this.refresh();
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getBranches().find(branch => branch.parentNoteId === '_lbBookmarks')) {
            this.refresh();
        }

        if (loadResults.getAttributes().find(attr => attr.type === 'label'
            && ['iconClass', 'workspaceIconClass', 'bookmarkFolder'].includes(attr.name)
            && this.noteIds.includes(attr.noteId))
        ) {
            this.refresh();
        }
    }
}
