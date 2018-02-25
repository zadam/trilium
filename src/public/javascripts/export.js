"use strict";

function exportSubTree(noteId) {
    const url = getHost() + "/api/export/" + noteId;

    download(url);
}

function importSubTree(noteId) {

}