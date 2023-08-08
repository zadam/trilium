import protectedSessionService from '../../services/protected_session.js';
import TypeWidget from "./type_widget.js";

const TPL = `
<div class="protected-session-password-component note-detail-printable">
    <style>
    .protected-session-password-component {
        width: 300px;
        margin: 30px auto auto;
    }
    </style>

    <form class="protected-session-password-form">
        <div class="form-group">
            <label for="protected-session-password-in-detail">Showing protected note requires entering your password:</label>
            <input class="protected-session-password-in-detail form-control protected-session-password" type="password">
        </div>

        <button class="btn btn-primary">Start protected session <kbd>enter</kbd></button>
    </form>
</div>`;

export default class ProtectedSessionTypeWidget extends TypeWidget {
    static getType() { return "protectedSession"; }

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

        super.doRender();
    }
}
