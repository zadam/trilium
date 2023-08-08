const path = require("path");
const mimeTypes = require("mime-types");

function getFileName(note, childTargetPath, safeTitle) {
    let existingExtension = path.extname(safeTitle).toLowerCase();
    let newExtension;

    if (note.type === 'text') {
        newExtension = 'html';
    } else if (note.mime === 'application/x-javascript' || note.mime === 'text/javascript') {
        newExtension = 'js';
    } else if (existingExtension.length > 0) { // if the page already has an extension, then we'll just keep it
        newExtension = null;
    } else {
        if (note.mime?.toLowerCase()?.trim() === "image/jpg") { // image/jpg is invalid but pretty common
            newExtension = 'jpg';
        } else {
            newExtension = mimeTypes.extension(note.mime) || "dat";
        }
    }

    let fileNameWithPath = childTargetPath;

    // if the note is already named with extension (e.g. "jquery"), then it's silly to append exact same extension again
    if (newExtension && existingExtension !== "." + newExtension.toLowerCase()) {
        fileNameWithPath += "." + newExtension;
    }

    return fileNameWithPath;
}

module.exports = {
    getFileName
};
