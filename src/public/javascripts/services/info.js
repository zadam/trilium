import ws from "./ws.js";
import utils from "./utils.js";

function toast(options) {
    const $toast = $(`<div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
    <div class="toast-header">
        <strong class="mr-auto"><span class="jam jam-${options.icon}"></span> ${options.title}</strong>
        <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
            <span aria-hidden="true">&times;</span>
        </button>
    </div>
    <div class="toast-body">
        ${options.message}
    </div>
</div>`);

    $("#toast-container").append($toast);

    $toast.toast({
        delay: options.delay
    }).toast("show");
}

function showMessage(message, delay = 3000) {
    console.debug(utils.now(), "message: ", message);

    toast({
        title: "Info",
        icon: "check",
        message: message,
        delay
    });
}

function showAndLogError(message, delay = 10000) {
    showError(message, delay);

    ws.logError(message);
}

function showError(message, delay = 10000) {
    console.log(utils.now(), "error: ", message);

    toast({
        title: "Error",
        icon: 'alert',
        message: message,
        delay
    });
}

function throwError(message) {
    ws.logError(message);

    throw new Error(message);
}

export default {
    showMessage,
    showError,
    showAndLogError,
    throwError
}