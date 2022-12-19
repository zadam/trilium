import RightDropdownButtonWidget from "./right_dropdown_button.js";
import linkService from "../../services/link.js";

const DROPDOWN_TPL = `
<div class="bookmark-folder-widget">
    <style>
        .bookmark-folder-widget {
            min-width: 400px;
            max-height: 500px;
            padding: 7px 15px 0 15px;
            font-size: 1.2rem;
            overflow: auto;
        }
        
        .bookmark-folder-widget ul {
            padding: 0;
            list-style-type: none;
        }
        
        .bookmark-folder-widget .note-link {
            display: block;
            padding: 5px 10px 5px 5px;
        }
        
        .bookmark-folder-widget .note-link:hover {
            background-color: var(--accented-background-color);
            text-decoration: none;
        }
        
        .dropdown-menu .bookmark-folder-widget a:hover {
            text-decoration: none;
            background: transparent !important;
        }
        
        .bookmark-folder-widget li .note-link {
            padding-left: 35px;
        }
    </style>
    
    <div class="parent-note"></div>
    
    <ul class="children-notes"></ul>
</div>`;

export default class BookmarkFolderWidget extends RightDropdownButtonWidget {
    constructor(note) {
        super(note.title, note.getIcon(), DROPDOWN_TPL);

        this.note = note;
    }

    doRender() {
        super.doRender();

        this.$parentNote = this.$dropdownContent.find('.parent-note');
        this.$childrenNotes = this.$dropdownContent.find('.children-notes');
    }

    async dropdownShown() {
        this.$parentNote.empty();
        this.$childrenNotes.empty();

        const linkOptions = {
            showTooltip: false,
            showNoteIcon: true
        };

        this.$parentNote.append(
            (await linkService.createNoteLink(this.note.noteId, linkOptions))
                .addClass("note-link")
        );

        for (const childNote of await this.note.getChildNotes()) {
            this.$childrenNotes.append(
                $("<li>")
                    .append(
                        (await linkService.createNoteLink(childNote.noteId, linkOptions))
                            .addClass("note-link")
                    )
            );
        }
    }

    refreshIcon() {}
}
