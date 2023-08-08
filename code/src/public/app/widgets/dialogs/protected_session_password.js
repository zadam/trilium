import protectedSessionService from "../../services/protected_session.js";
import utils from "../../services/utils.js";
import BasicWidget from "../basic_widget.js";

const TPL = `
<div class="protected-session-password-dialog modal mx-auto" data-backdrop="false" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-md" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title mr-auto">Protected session</h5>

                <button class="help-button" type="button" data-help-page="Protected-notes" title="Help on Protected notes">?</button>

                <button type="button" class="close" data-dismiss="modal" aria-label="Close" style="margin-left: 0;">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <form class="protected-session-password-form">
                <div class="modal-body">
                    <div class="form-group">
                        <label>
                            To proceed with requested action you need to start protected session by entering password:
                            <input class="form-control protected-session-password" type="password">
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary">Start protected session <kbd>enter</kbd></button>
                </div>
            </form>
        </div>
    </div>
</div>`;

export default class ProtectedSessionPasswordDialog extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$passwordForm = this.$widget.find(".protected-session-password-form");
        this.$passwordInput = this.$widget.find(".protected-session-password");
        this.$passwordForm.on('submit', () => {
            const password = this.$passwordInput.val();
            this.$passwordInput.val("");

            protectedSessionService.setupProtectedSession(password);

            return false;
        });
    }

    showProtectedSessionPasswordDialogEvent() {
        utils.openDialog(this.$widget);

        this.$passwordInput.trigger('focus');
    }

    closeProtectedSessionPasswordDialogEvent() {
        this.$widget.modal('hide');
    }
}
