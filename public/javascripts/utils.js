"use strict";

function showMessage(message) {
    console.log("message: ", message);

    $.notify({
        // options
        message: message
    },{
        // settings
        type: 'success',
        delay: 1500
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

function getDateFromTS(timestamp) {
    // Date accepts number of milliseconds since epoch so UTC timestamp works without any extra handling
    // see https://stackoverflow.com/questions/4631928/convert-utc-epoch-to-local-date-with-javascript
    return new Date(timestamp * 1000);
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