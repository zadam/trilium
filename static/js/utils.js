function message(str) {
    const top = $("#top-message");

    top.fadeIn(1500).css("display","inline-block");
    top.html(str);
    top.fadeOut(1500);
}

function error(str) {
    const error = $("#error-message");

    error.show().css("display","inline-block");
    error.html(str);
    error.fadeOut(10000);
}

function getAutocompleteItems(noteIds) {
    const autocompleteItems = [];

    for (const noteId of noteIds) {
        const fullName = getFullName(noteId);

        if (fullName !== null) {
            autocompleteItems.push({
                value: fullName + " (" + noteId + ")",
                label: fullName
            });
        }
    }

    return autocompleteItems;
}

function uint8ToBase64(u8Arr) {
    const CHUNK_SIZE = 0x8000; //arbitrary number
    const length = u8Arr.length;
    let index = 0;
    let result = '';
    let slice;
    while (index < length) {
        slice = u8Arr.subarray(index, Math.min(index + CHUNK_SIZE, length));
        result += String.fromCharCode.apply(null, slice);
        index += CHUNK_SIZE;
    }
    return btoa(result);
}

function base64ToUint8Array(base64encoded) {
    return new Uint8Array(atob(base64encoded).split("").map(function(c) { return c.charCodeAt(0); }));
}

function getDateFromTS(timestamp) {
    // Date accepts number of milliseconds since epoch so UTC timestamp works without any extra handling
    // see https://stackoverflow.com/questions/4631928/convert-utc-epoch-to-local-date-with-javascript
    const utcDate = new Date(timestamp * 1000);

    const localDate = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60 * 1000);

    return localDate;
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