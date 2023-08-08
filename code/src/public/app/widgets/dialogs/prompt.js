import utils from "../../services/utils.js";
import BasicWidget from "../basic_widget.js";

const TPL = `
<div class="prompt-dialog modal mx-auto" tabindex="-1" role="dialog" style="z-index: 2000;">
    <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
            <form class="prompt-dialog-form">
                <div class="modal-header">
                    <h5 class="prompt-title modal-title mr-auto">Prompt</h5>

                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                </div>
                <div class="modal-footer">
                    <button class="prompt-dialog-ok-button btn btn-primary btn-sm">OK <kbd>enter</kbd></button>
                </div>
            </form>
        </div>
    </div>
</div>`;

export default class PromptDialog extends BasicWidget {
    constructor() {
        super();

        this.resolve = null;
        this.shownCb = null;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$dialogBody = this.$widget.find(".modal-body");
        this.$form = this.$widget.find(".prompt-dialog-form");
        this.$question = null;
        this.$answer = null;

        this.$widget.on('shown.bs.modal', () => {
            if (this.shownCb) {
                this.shownCb({
                    $dialog: this.$widget,
                    $question: this.$question,
                    $answer: this.$answer,
                    $form: this.$form
                });
            }

            this.$answer.trigger('focus').select();
        });

        this.$widget.on("hidden.bs.modal", () => {
            if (this.resolve) {
                this.resolve(null);
            }
        });

        this.$form.on('submit', e => {
            e.preventDefault();
            this.resolve(this.$answer.val());

            this.$widget.modal('hide');
        });
    }

    showPromptDialogEvent({ title, message, defaultValue, shown, callback }) {
        this.shownCb = shown;
        this.resolve = callback;

        this.$widget.find(".prompt-title").text(title || "Prompt");

        this.$question = $("<label>")
            .prop("for", "prompt-dialog-answer")
            .text(message);

        this.$answer = $("<input>")
            .prop("type", "text")
            .prop("id", "prompt-dialog-answer")
            .addClass("form-control")
            .val(defaultValue || "");

        this.$dialogBody.empty().append(
            $("<div>")
                .addClass("form-group")
                .append(this.$question)
                .append(this.$answer));

        utils.openDialog(this.$widget, false);
    }
}
