"use strict";

function reloadApp() {
    window.location.reload(true);
}

function showMessage(message) {
    console.log("message: ", message);

    $.notify({
        // options
        message: message
    },{
        // settings
        type: 'success',
        delay: 3000
    });
}

function showError(message, delay = 10000) {
    console.log("error: ", message);

    $.notify({
        // options
        message: message
    },{
        // settings
        type: 'danger',
        delay: delay
    });
}

function throwError(message) {
    messaging.logError(message);

    throw new Error(message);
}

function parseDate(str) {
    try {
        return new Date(Date.parse(str));
    }
    catch (e) {
        throw new Error("Can't parse date from " + str + ": " + e.stack);
    }
}

function padNum(num) {
    return (num <= 9 ? "0" : "") + num;
}

function formatTime(date) {
    return padNum(date.getHours()) + ":" + padNum(date.getMinutes());
}

function formatDate(date) {
    return padNum(date.getDate()) + ". " + padNum(date.getMonth() + 1) + ". " + date.getFullYear();
}

function formatDateTime(date) {
    return formatDate(date) + " " + formatTime(date);
}

function isElectron() {
    return window && window.process && window.process.type;
}