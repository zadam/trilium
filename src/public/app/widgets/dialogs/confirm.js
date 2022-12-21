import BasicWidget from "../basic_widget.js";

const DELETE_NOTE_BUTTON_CLASS = "confirm-dialog-delete-note";

const TPL = `
<div class="confirm-dialog modal mx-auto" tabindex="-1" role="dialog" style="z-index: 2000;">
    <div class="modal-dialog modal-dialog-scrollable" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title mr-auto">Confirmation</h5>

                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <div class="confirm-dialog-content"></div>

                <div class="confirm-dialog-custom"></div>
            </div>
            <div class="modal-footer">
                <button class="confirm-dialog-cancel-button btn btn-sm">Cancel</button>

                &nbsp;

                <button class="confirm-dialog-ok-button btn btn-primary btn-sm">OK</button>
            </div>
        </div>
    </div>
</div>`;

export default class ConfirmDialog extends BasicWidget {
    constructor() {
        super();

        this.resolve = null;
        this.$originallyFocused = null; // element focused before the dialog was opened, so we can return to it afterwards
    }

    doRender() {
        this.$widget = $(TPL);
        this.$confirmContent = this.$widget.find(".confirm-dialog-content");
        this.$okButton = this.$widget.find(".confirm-dialog-ok-button");
        this.$cancelButton = this.$widget.find(".confirm-dialog-cancel-button");
        this.$custom = this.$widget.find(".confirm-dialog-custom");

        this.$widget.on('shown.bs.modal', () => this.$okButton.trigger("focus"));

        this.$widget.on("hidden.bs.modal", () => {
            if (this.resolve) {
                this.resolve(false);
            }

            if (this.$originallyFocused) {
                this.$originallyFocused.trigger('focus');
                this.$originallyFocused = null;
            }
        });

        this.$cancelButton.on('click', () => this.doResolve(false));
        this.$okButton.on('click', () => this.doResolve(true));
    }

    showConfirmDialogEvent({message, callback}) {
        this.$originallyFocused = $(':focus');

        this.$custom.hide();

        glob.activeDialog = this.$widget;

        if (typeof message === 'string') {
            message = $("<div>").text(message);
        }

        this.$confirmContent.empty().append(message);

        this.$widget.modal();

        this.resolve = callback;
    }

    showConfirmDeleteNoteBoxWithNoteDialogEvent({title, callback}) {
        glob.activeDialog = this.$widget;

        this.$confirmContent.text(`Are you sure you want to remove the note "${title}" from relation map?`);

        this.$custom.empty()
            .append("<br/>")
            .append($("<div>")
                .addClass("form-check")
                .append(
                    $("<label>")
                        .addClass("form-check-label")
                        .attr("style", "text-decoration: underline dotted var(--main-text-color)")
                        .attr("title", "If you don't check this, the note will be only removed from the relation map.")
                        .append(
                            $("<input>")
                                .attr("type", "checkbox")
                                .addClass(`form-check-input ${DELETE_NOTE_BUTTON_CLASS}`)
                        )
                        .append("Also delete the note")
                ));

        this.$custom.show();

        this.$widget.modal();

        this.resolve = callback;
    }

    doResolve(ret) {
        this.resolve({
            confirmed: ret,
            isDeleteNoteChecked: this.$widget.find(`.${DELETE_NOTE_BUTTON_CLASS}:checked`).length > 0
        });

        this.resolve = null;

        this.$widget.modal("hide");
    }
}
