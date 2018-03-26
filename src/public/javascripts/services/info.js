import messagingService from "./messaging.js";
import utils from "./utils.js";

function showMessage(message) {
    console.log(utils.now(), "message: ", message);

    $.notify({
        // options
        message: message
    }, {
        // settings
        type: 'success',
        delay: 3000
    });
}

function showError(message, delay = 10000) {
    console.log(utils.now(), "error: ", message);

    $.notify({
        // options
        message: message
    }, {
        // settings
        type: 'danger',
        delay: delay
    });
}

function throwError(message) {
    messagingService.logError(message);

    throw new Error(message);
}

export default {
    showMessage,
    showError,
    throwError
}