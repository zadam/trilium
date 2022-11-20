import utils from "../../services/utils.js";
import BasicWidget from "../basic_widget.js";

const TPL = `
<div class="password-not-set-dialog modal fade mx-auto" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-md" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title mr-auto">Password is not set</h5>

                <button type="button" class="close" data-dismiss="modal" aria-label="Close" style="margin-left: 0;">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                Protected notes are encrypted using a user password, but password has not been set yet.

                To be able to protect notes, <a class="open-password-options-button" href="javascript:">
                    click here to open the Options dialog</a> and set your password.
            </div>
        </div>
    </div>
</div>
`;

export default class PasswordNoteSetDialog extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$openPasswordOptionsButton = this.$widget.find(".open-password-options-button");
        this.$openPasswordOptionsButton.on("click", () => {
            this.triggerCommand("showOptions", { openTab: 'PasswordOptions' });
        });
    }

    showPasswordNotSetEvent() {
        utils.openDialog(this.$widget);
    }
}
