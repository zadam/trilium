"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const labels = require('../../services/labels');
const notes = require('../../services/notes');
const wrap = require('express-promise-wrap').wrap;
const tar = require('tar-stream');
const multer = require('multer')();
const stream = require('stream');
const path = require('path');

function getFileName(name) {
    let key;

    if (name.endsWith(".dat")) {
        key = "data";
        name = name.substr(0, name.length - 4);
    }
    else if (name.endsWith((".meta"))) {
        key = "meta";
        name = name.substr(0, name.length - 5);
    }
    else {
        throw new Error("Unknown file type in import archive: " + name);
    }
    return {name, key};
}

async function parseImportFile(file) {
    const fileMap = {};
    const files = [];

    const extract = tar.extract();

    extract.on('entry', function(header, stream, next) {
        let {name, key} = getFileName(header.name);

        let file = fileMap[name];

        if (!file) {
            file = fileMap[name] = {
                children: []
            };

            let parentFileName = path.dirname(header.name);

            if (parentFileName && parentFileName !== '.') {
                fileMap[parentFileName].children.push(file);
            }
            else {
                files.push(file);
            }
        }

        const chunks = [];

        stream.on("data", function (chunk) {
            chunks.push(chunk);
        });

        // header is the tar header
        // stream is the content body (might be an empty stream)
        // call next when you are done with this entry

        stream.on('end', function() {
            file[key] = Buffer.concat(chunks);

            if (key === "meta") {
                file[key] = JSON.parse(file[key].toString("UTF-8"));
            }

            next(); // ready for next entry
        });

        stream.resume(); // just auto drain the stream
    });

    return new Promise(resolve => {
        extract.on('finish', function() {
            resolve(files);
        });

        const bufferStream = new stream.PassThrough();
        bufferStream.end(file.buffer);

        bufferStream.pipe(extract);
    });
}

async function importTar(req) {
    const sourceId = req.headers.source_id;
    const parentNoteId = req.params.parentNoteId;
    const file = req.file;

    const note = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [parentNoteId]);

    if (!note) {
        return [404, `Note ${parentNoteId} doesn't exist.`];
    }

    const files = await parseImportFile(file);

    await importNotes(files, parentNoteId, sourceId);
}

async function importNotes(files, parentNoteId, sourceId) {
    for (const file of files) {
        if (file.meta.version !== 1) {
            throw new Error("Can't read meta data version " + file.meta.version);
        }

        if (file.meta.type !== 'file') {
            file.data = file.data.toString("UTF-8");
        }

        const noteId = await notes.createNote(parentNoteId, file.meta.title, file.data, {
            type: file.meta.type,
            mime: file.meta.mime,
            sourceId: sourceId
        });

        for (const attr of file.meta.labels) {
            await labels.createLabel(noteId, attr.name, attr.value);
        }

        if (file.children.length > 0) {
            await importNotes(file.children, noteId, sourceId);
        }
    }
}

module.exports = {
    importTar
};