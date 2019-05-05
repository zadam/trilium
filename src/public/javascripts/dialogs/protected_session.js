import protectedSessionService from "../services/protected_session.js";

const $dialog = $("#protected-session-password-dialog");
const $passwordForm = $dialog.find(".protected-session-password-form");
const $passwordInput = $dialog.find(".protected-session-password");

function show() {
    $dialog.modal();

    $passwordInput.focus();
}

function close() {
    // this may fal if the dialog has not been previously opened (not sure if still true with Bootstrap modal)
    try {
        $dialog.modal('hide');
    }
    catch (e) {}
}

$passwordForm.submit(() => {
    const password = $passwordInput.val();
    $passwordInput.val("");

    protectedSessionService.setupProtectedSession(password);

    return false;
});

export default {
    show,
    close
}