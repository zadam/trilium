import ws from "./ws.js";
import utils from "./utils.js";

function showMessage(message) {
    console.debug(utils.now(), "message: ", message);

    $.notify({
        icon: 'jam jam-check',
        message: message
    }, getNotifySettings('success', 3000));
}

function showAndLogError(message, delay = 10000) {
    showError(message, delay);

    ws.logError(message);
}

function showError(message, delay = 10000) {
    console.log(utils.now(), "error: ", message);

    $.notify({
        // options
        icon: 'jam jam-alert',
        message: message
    }, getNotifySettings('danger', delay));
}

function getNotifySettings(type, delay) {
    return {
        element: 'body',
        type: type,
        z_index: 90000,
        placement: {
            from: "top",
            align: "center"
        },
        animate: {
            enter: 'animated fadeInDown',
            exit: 'animated fadeOutUp'
        },
        delay: delay
    };
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