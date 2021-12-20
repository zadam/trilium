import attributeService from "../services/attributes.js";
import SwitchWidget from "./switch.js";

export default class BookmarkSwitchWidget extends SwitchWidget {
    doRender() {
        super.doRender();

        this.$switchOnName.text("Bookmark");
        this.$switchOnButton.attr("title", "Bookmark this note to the left side panel");

        this.$switchOffName.text("Bookmark");
        this.$switchOffButton.attr("title", "Remove bookmark");
    }

    async switchOff() {
        for (const label of this.note.getLabels('bookmarked')) {
            await attributeService.removeAttributeById(this.noteId, label.attributeId);
        }
    }

    switchOn() {
        return attributeService.setLabel(this.noteId, 'bookmarked');
    }

    refreshWithNote(note) {
        const isBookmarked = note.hasLabel('bookmarked');

        this.$switchOn.toggle(!isBookmarked);
        this.$switchOff.toggle(isBookmarked);
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
