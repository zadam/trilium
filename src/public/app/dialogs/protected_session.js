import protectedSessionService from "../services/protected_session.js";
import utils from "../services/utils.js";

const $dialog = $("#protected-session-password-dialog");
const $passwordForm = $dialog.find(".protected-session-password-form");
const $passwordInput = $dialog.find(".protected-session-password");

export function show() {
    utils.openDialog($dialog);

    $passwordInput.trigger('focus');
}

export function close() {
    // this may fail if the dialog has not been previously opened (not sure if still true with Bootstrap modal)
    try {
        $dialog.modal('hide');
    }
    catch (e) {}
}

$passwordForm.on('submit', () => {
    const password = $passwordInput.val();
    $passwordInput.val("");

    protectedSessionService.setupProtectedSession(password);

    return false;
});
