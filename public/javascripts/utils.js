"use strict";

function showMessage(str) {
    console.log("message: ", str);

    const top = $("#top-message");

    top.fadeIn(1500).css("display","inline-block");
    top.html(str);
    top.fadeOut(1500);
}

function showError(str) {
    console.log("error: ", str);

    const error = $("#error-message");

    error.show().css("display","inline-block");
    error.html(str);
    error.fadeOut(10000);
}

function getAutocompleteItems(noteIds) {
    const autocompleteItems = [];

    for (const noteId of noteIds) {
        const fullName = treeUtils.getFullName(noteId);

        if (fullName !== null) {
            autocompleteItems.push({
                value: fullName + " (" + noteId + ")",
                label: fullName
            });
        }
    }

    autocompleteItems.sort((a, b) => a.value < b.value ? -1 : 1);

    return autocompleteItems;
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