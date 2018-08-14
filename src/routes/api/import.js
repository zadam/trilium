"use strict";

const repository = require('../../services/repository');
const attributeService = require('../../services/attributes');
const noteService = require('../../services/notes');
const Branch = require('../../entities/branch');
const tar = require('tar-stream');
const stream = require('stream');
const path = require('path');
const parseString = require('xml2js').parseString;

async function importToBranch(req) {
    const parentNoteId = req.params.parentNoteId;
    const file = req.file;

    const parentNote = await repository.getNote(parentNoteId);

    if (!parentNote) {
        return [404, `Note ${parentNoteId} doesn't exist.`];
    }

    const extension = path.extname(file.originalname).toLowerCase();

    if (extension === '.tar') {
        await importTar(file, parentNoteId);
    }
    else if (extension === '.opml') {
        return await importOpml(file, parentNoteId);
    }
    else {
        return [400, `Unrecognized extension ${extension}, must be .tar or .opml`];
    }
}

function toHtml(text) {
    if (!text) {
        return '';
    }

    return '<p>' + text.replace(/(?:\r\n|\r|\n)/g, '</p><p>') + '</p>';
}

async function importOutline(outline, parentNoteId) {
    const {note} = await noteService.createNote(parentNoteId, outline.$.title, toHtml(outline.$.text));

    for (const childOutline of (outline.outline || [])) {
        await importOutline(childOutline, note.noteId);
    }
}

async function importOpml(file, parentNoteId) {
    const xml = await new Promise(function(resolve, reject)
    {
        parseString(file.buffer, function (err, result) {
            if (err) {
                reject(err);
            }
            else {
                resolve(result);
            }
        });
    });

    if (xml.opml.$.version !== '1.0' && xml.opml.$.version !== '1.1') {
        return [400, 'Unsupported OPML version ' + xml.opml.$.version + ', 1.0 or 1.1 expected instead.'];
    }

    const outlines = xml.opml.body[0].outline || [];

    for (const outline of outlines) {
        await importOutline(outline, parentNoteId);
    }
}

async function importTar(file, parentNoteId) {
    const files = await parseImportFile(file);

    // maps from original noteId (in tar file) to newly generated noteId
    const noteIdMap = {};

    await importNotes(files, parentNoteId, noteIdMap);
}

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
        const {name, key} = getFileName(header.name);

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

async function importNotes(files, parentNoteId, noteIdMap) {
    for (const file of files) {
        if (file.meta.version !== 1) {
            throw new Error("Can't read meta data version " + file.meta.version);
        }

        if (file.meta.clone) {
            await new Branch({
                parentNoteId: parentNoteId,
                noteId: noteIdMap[file.meta.noteId],
                prefix: file.meta.prefix
            }).save();

            return;
        }

        if (file.meta.type !== 'file') {
            file.data = file.data.toString("UTF-8");
        }

        const {note} = await noteService.createNote(parentNoteId, file.meta.title, file.data, {
            type: file.meta.type,
            mime: file.meta.mime,
            prefix: file.meta.prefix
        });

        noteIdMap[file.meta.noteId] = note.noteId;

        for (const attribute of file.meta.attributes) {
            await attributeService.createAttribute({
                noteId: note.noteId,
                type: attribute.type,
                name: attribute.name,
                value: attribute.value,
                isInheritable: attribute.isInheritable,
                position: attribute.position
            });
        }

        if (file.children.length > 0) {
            await importNotes(file.children, note.noteId, noteIdMap);
        }
    }
}

module.exports = {
    importToBranch
};