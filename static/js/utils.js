function message(str) {
    const top = $("#top-message");

    top.fadeIn(1500);
    top.html(str);
    top.fadeOut(1500);
}

function error(str) {
    const error = $("#error-message");

    error.show();
    error.html(str);
    error.fadeOut(10000);
}

function getAutocompleteItems(notes) {
    const autocompleteItems = [];

    for (const noteId of notes) {
        const fullName = getFullName(noteId);

        autocompleteItems.push({
            value: fullName + " (" + noteId + ")",
            label: fullName
        });
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