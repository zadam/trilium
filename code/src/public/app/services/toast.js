import ws from "./ws.js";
import utils from "./utils.js";

function toast(options) {
    const $toast = $(`<div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
    <div class="toast-header">
        <strong class="mr-auto"><span class="bx bx-${options.icon}"></span> <span class="toast-title"></span></strong>
        <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
            <span aria-hidden="true">&times;</span>
        </button>
    </div>
    <div class="toast-body"></div>
</div>`);

    $toast.find('.toast-title').text(options.title);
    $toast.find('.toast-body').text(options.message);

    if (options.id) {
        $toast.attr("id", `toast-${options.id}`);
    }

    $("#toast-container").append($toast);

    $toast.toast({
        delay: options.delay || 3000,
        autohide: !!options.autohide
    });

    $toast.on('hidden.bs.toast', e => e.target.remove());

    $toast.toast("show");

    return $toast;
}

function showPersistent(options) {
    let $toast = $(`#toast-${options.id}`);

    if ($toast.length > 0) {
        $toast.find('.toast-body').html(options.message);
    }
    else {
        options.autohide = false;

        $toast = toast(options);
    }

    if (options.closeAfter) {
        setTimeout(() => $toast.remove(), options.closeAfter);
    }
}

function closePersistent(id) {
    $(`#toast-${id}`).remove();
}

function showMessage(message, delay = 2000) {
    console.debug(utils.now(), "message:", message);

    toast({
        title: "Info",
        icon: "check",
        message: message,
        autohide: true,
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
        autohide: true,
        delay
    });
}

function showErrorTitleAndMessage(title, message, delay = 10000) {
    console.log(utils.now(), "error: ", message);

    toast({
        title: title,
        icon: 'alert',
        message: message,
        autohide: true,
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
    showErrorTitleAndMessage,
    showAndLogError,
    throwError,
    showPersistent,
    closePersistent
}
