import OnClickButtonWidget from "./onclick_button.js";
import appContext from "../../components/app_context.js";
import attributeService from "../../services/attributes.js";
import protectedSessionHolder from "../../services/protected_session_holder.js";

export default class EditButton extends OnClickButtonWidget {
    isEnabled() {
        return super.isEnabled()
            && this.note
            && this.noteContext.viewScope.viewMode === 'default';
    }

    constructor() {
        super();

        this.icon("bx-edit-alt")
            .title("Edit this note")
            .titlePlacement("bottom")
            .onClick(widget => {
                this.noteContext.viewScope.readOnlyTemporarilyDisabled = true;

                appContext.triggerEvent('readOnlyTemporarilyDisabled', {noteContext: this.noteContext});

                this.refresh();
            });
    }

    async refreshWithNote(note) {
        if (note.isProtected && !protectedSessionHolder.isProtectedSessionAvailable()) {
            this.toggleInt(false);
        }
        else {
            // prevent flickering by assuming hidden before async operation
            this.toggleInt(false);

            const wasVisible = this.isVisible();

            // can't do this in isEnabled() since isReadOnly is async
            this.toggleInt(await this.noteContext.isReadOnly());

            // make the edit button stand out on the first display, otherwise
            // it's difficult to notice that the note is readonly
            if (this.isVisible() && !wasVisible) {
                this.$widget.addClass("bx-tada bx-lg");

                setTimeout(() => {
                    this.$widget.removeClass("bx-tada bx-lg");
                }, 1700);
            }
        }

        await super.refreshWithNote(note);
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributes().find(
            attr => attr.type === 'label'
                && attr.name.toLowerCase().includes("readonly")
                && attributeService.isAffecting(attr, this.note)
        )) {
            this.noteContext.viewScope.readOnlyTemporarilyDisabled = false;

            this.refresh();
        }
    }

    async noteTypeMimeChangedEvent({noteId}) {
        if (this.isNote(noteId)) {
            await this.refresh();
        }
    }
}
