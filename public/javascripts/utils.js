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

function showError(message) {
    console.log("error: ", message);

    $.notify({
        // options
        message: message
    },{
        // settings
        type: 'danger',
        delay: 10000
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

function formatTime(date) {
    return (date.getHours() <= 9 ? "0" : "") + date.getHours() + ":" + (date.getMinutes() <= 9 ? "0" : "") + date.getMinutes();
}

function formatDate(date) {
    return date.getDate() + ". " + (date.getMonth() + 1) + ". " + date.getFullYear();
}

function formatDateTime(date) {
    return formatDate(date) + " " + formatTime(date);
}

function isElectron() {
    return window && window.process && window.process.type;
}