import server from "../../../services/server.js";
import protectedSessionHolder from "../../../services/protected_session_holder.js";
import toastService from "../../../services/toast.js";

const TPL = `
<div>
    <h4 id="password-heading"></h4>
    
    <div class="alert alert-warning" role="alert" style="font-weight: bold; color: red !important;">
      Please take care to remember your new password. Password is used for logging into the web interface and
      to encrypt protected notes. If you forget your password, then all your protected notes are forever lost. 
      In case you did forget your password, <a id="reset-password-button" href="javascript:">click here to reset it</a>.
    </div>
    
    <form id="change-password-form">
        <div class="form-group" id="old-password-form-group">
            <label for="old-password">Old password</label>
            <input class="form-control" id="old-password" type="password">
        </div>
    
        <div class="form-group">
            <label for="new-password1">New password</label>
            <input class="form-control" id="new-password1" type="password">
        </div>
    
        <div class="form-group">
            <label for="new-password2">New password Confirmation</label>
            <input class="form-control" id="new-password2" type="password">
        </div>
    
        <button class="btn btn-primary" id="save-password-button">Change password</button>
    </form>
</div>

<br/>

<div>
    <h4>Protected session timeout</h4>

    <p>Protected session timeout is a time period after which the protected session is wiped from
        the browser's memory. This is measured from the last interaction with protected notes. See <a href="https://github.com/zadam/trilium/wiki/Protected-notes" class="external">wiki</a> for more info.</p>

    <div class="form-group">
        <label for="protected-session-timeout-in-seconds">Protected session timeout (in seconds)</label>
        <input class="form-control" id="protected-session-timeout-in-seconds" type="number" min="60">
    </div>
</div>`;

export default class PasswordOptions {
    constructor() {
        $("#options-password").html(TPL);

        this.$passwordHeading = $("#password-heading");
        this.$changePasswordForm = $("#change-password-form");
        this.$oldPassword = $("#old-password");
        this.$newPassword1 = $("#new-password1");
        this.$newPassword2 = $("#new-password2");
        this.$savePasswordButton = $("#save-password-button");
        this.$resetPasswordButton = $("#reset-password-button");

        this.$resetPasswordButton.on("click", async () => {
            if (confirm("By resetting the password you will forever lose access to all your existing protected notes. Do you really want to reset the password?")) {
                await server.post("password/reset?really=yesIReallyWantToResetPasswordAndLoseAccessToMyProtectedNotes");

                const options = await server.get('options');
                this.optionsLoaded(options);

                toastService.showError("Password has been reset. Please set new password");
            }
        });

        this.$changePasswordForm.on('submit', () => this.save());

        this.$protectedSessionTimeout = $("#protected-session-timeout-in-seconds");

        this.$protectedSessionTimeout.on('change', () => {
            const protectedSessionTimeout = this.$protectedSessionTimeout.val();

            server.put('options', { 'protectedSessionTimeout': protectedSessionTimeout }).then(() => {
                toastService.showMessage("Options changed have been saved.");
            });

            return false;
        });
    }

    optionsLoaded(options) {
        const isPasswordSet = options.isPasswordSet === 'true';

        $("#old-password-form-group").toggle(isPasswordSet);
        this.$passwordHeading.text(isPasswordSet ? 'Change password' : 'Set password');
        this.$savePasswordButton.text(isPasswordSet ? 'Change password' : 'Set password');
        this.$protectedSessionTimeout.val(options['protectedSessionTimeout']);
    }

    save() {
        const oldPassword = this.$oldPassword.val();
        const newPassword1 = this.$newPassword1.val();
        const newPassword2 = this.$newPassword2.val();

        this.$oldPassword.val('');
        this.$newPassword1.val('');
        this.$newPassword2.val('');

        if (newPassword1 !== newPassword2) {
            toastService.showError("New passwords are not the same.");
            return false;
        }

        server.post('password/change', {
            'current_password': oldPassword,
            'new_password': newPassword1
        }).then(result => {
            if (result.success) {
                toastService.showError("Password has been changed. Trilium will be reloaded after you press OK.");

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
