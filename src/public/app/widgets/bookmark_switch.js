import NoteContextAwareWidget from "./note_context_aware_widget.js";
import protectedSessionService from "../services/protected_session.js";
import attributeService from "../services/attributes.js";

const TPL = `
<div class="bookmark-switch">
    <style>    
    /* The switch - the box around the slider */
    .bookmark-switch .switch {
        position: relative;
        display: inline-block;
        width: 50px;
        height: 24px;
        float: right;
    }
    
    /* The slider */
    .bookmark-switch .slider {
        border-radius: 24px;
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--more-accented-background-color);
        transition: .4s;
    }
    
    .bookmark-switch .slider:before {
        border-radius: 50%;
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 4px;
        bottom: 4px;
        background-color: var(--main-background-color);
        -webkit-transition: .4s;
        transition: .4s;
    }
    
    .bookmark-switch .slider.checked {
        background-color: var(--main-text-color);
    }
    
    .bookmark-switch .slider.checked:before {
        transform: translateX(26px);
    }
    </style>

    <div class="add-bookmark-button">
        Bookmark
    
        &nbsp;
    
        <span title="Bookmark this note to the left side panel">
            <label class="switch">
            <span class="slider"></span>
        </span>
    </div>
    <div class="remove-bookmark-button">
        Bookmark
        
        &nbsp;
    
        <span title="Remove bookmark">
            <label class="switch">
            <span class="slider checked"></span>
        </span>
    </div>
</div>`;

export default class BookmarkSwitchWidget extends NoteContextAwareWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$addBookmarkButton = this.$widget.find(".add-bookmark-button");
        this.$addBookmarkButton.on('click', () => attributeService.setLabel(this.noteId, 'bookmarked'));

        this.$removeBookmarkButton = this.$widget.find(".remove-bookmark-button");
        this.$removeBookmarkButton.on('click', async () => {
            for (const label of this.note.getLabels('bookmarked')) {
                await attributeService.removeAttributeById(this.noteId, label.attributeId);
            }
        });
    }

    refreshWithNote(note) {
        const isBookmarked = note.hasLabel('bookmarked');

        this.$addBookmarkButton.toggle(!isBookmarked);
        this.$removeBookmarkButton.toggle(isBookmarked);
    }

    entitiesReloadedEvent({loadResults}) {
        for (const attr of loadResults.getAttributes()) {
            if (attr.type === 'label'
                && attr.name === 'bookmarked'
                && attributeService.isAffecting(attr, this.note)) {

                this.refresh();
                break;
            }
        }
    }
}
