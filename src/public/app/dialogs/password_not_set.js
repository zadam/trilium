import utils from "../services/utils.js";
import appContext from "../services/app_context.js";

export function show() {
    const $dialog = $("#password-not-set-dialog");
    const $openPasswordOptionsButton = $("#open-password-options-button");

    utils.openDialog($dialog);

    $openPasswordOptionsButton.on("click", () => {
        appContext.triggerCommand("showOptions", { openTab: 'password' });
    });
}
