import server from "../../services/server.js";
import protectedSessionHolder from "../../services/protected_session_holder.js";
import toastService from "../../services/toast.js";

const TPL = `
<h3>Username</h3>

<p>Your username is <strong id="credentials-username"></strong>.</p>

<h3>Change password</h3>
<form id="change-password-form">
    <div class="form-group">
        <label for="old-password">Old password</label>
        <input class="form-control" id="old-password" type="password">
    </div>

    <div class="form-group">
        <label for="new-password1">New password</label>
        <input class="form-control" id="new-password1" type="password">
    </div>

    <div class="form-group">
        <label for="new-password2">New password once more</label>
        <input class="form-control" id="new-password2" type="password">
    </div>

    <button class="btn btn-primary">Change password</button>
</form>`;

export default class ChangePasswordOptions {
    constructor() {
        $("#options-credentials").html(TPL);

        this.$username = $("#credentials-username");
        this.$form = $("#change-password-form");
        this.$oldPassword = $("#old-password");
        this.$newPassword1 = $("#new-password1");
        this.$newPassword2 = $("#new-password2");

        this.$form.on('submit', () => this.save());
    }

    optionsLoaded(options) {
        this.$username.text(options.username);
    }

    save() {
        const oldPassword = this.$oldPassword.val();
        const newPassword1 = this.$newPassword1.val();
        const newPassword2 = this.$newPassword2.val();

        this.$oldPassword.val('');
        this.$newPassword1.val('');
        this.$newPassword2.val('');

        if (newPassword1 !== newPassword2) {
            alert("New passwords are not the same.");
            return false;
        }

        server.post('password/change', {
            'current_password': oldPassword,
            'new_password': newPassword1
        }).then(result => {
            if (result.success) {
                alert("Password has been changed. Trilium will be reloaded after you press OK.");

                // password changed so current protected session is invalid and needs to be cleared
                protectedSessionHolder.resetProtectedSession();
            }
            else {
                toastService.showError(result.message);
            }
        });

        return false;
    }
}