"use strict";

const repository = require('../../services/repository');
const log = require('../../services/log');
const attributeService = require('../../services/attributes');
const noteService = require('../../services/notes');
const Branch = require('../../entities/branch');
const tar = require('tar-stream');
const stream = require('stream');
const path = require('path');
const parseString = require('xml2js').parseString;
const commonmark = require('commonmark');

async function importToBranch(req) {
    const parentNoteId = req.params.parentNoteId;
    const file = req.file;

    const parentNote = await repository.getNote(parentNoteId);

    if (!parentNote) {
        return [404, `Note ${parentNoteId} doesn't exist.`];
    }

    const extension = path.extname(file.originalname).toLowerCase();

    if (extension === '.tar') {
        return await importTar(file, parentNoteId);
    }
    else if (extension === '.opml') {
        return await importOpml(file, parentNoteId);
    }
    else if (extension === '.md') {
        return await importMarkdown(file, parentNoteId);
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

    return note;
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
    let returnNote = null;

    for (const outline of outlines) {
        const note = await importOutline(outline, parentNoteId);

        // first created note will be activated after import
        returnNote = returnNote || note;
    }

    return returnNote;
}

async function importTar(file, parentNoteId) {
    const files = await parseImportFile(file);

    const ctx = {
        // maps from original noteId (in tar file) to newly generated noteId
        noteIdMap: {},
        attributes: [],
        reader: new commonmark.Parser(),
        writer: new commonmark.HtmlRenderer()
    };

    const note = await importNotes(ctx, files, parentNoteId);

    // we save attributes after importing notes because we need to have all the relation
    // targets already existing
    for (const attr of ctx.attributes) {
        if (attr.type === 'relation') {
            // map to local noteId
            attr.value = ctx.noteIdMap[attr.value];

            if (!attr.value) {
                // relation is targeting note not present in the import
                continue;
            }
        }

        await attributeService.createAttribute(attr);
    }

    return note;
}

function getFileName(name) {
    let key;

    if (name.endsWith(".dat")) {
        key = "data";
        name = name.substr(0, name.length - 4);
    }
    else if (name.endsWith(".md")) {
        key = "markdown";
        name = name.substr(0, name.length - 3);
    }
    else if (name.endsWith((".meta"))) {
        key = "meta";
        name = name.substr(0, name.length - 5);
    }
    else {
        log.error("Unknown file type in import: " + name);
    }

    return {name, key};
}

async function parseImportFile(file) {
    const fileMap = {};
    const files = [];

    const extract = tar.extract();

    extract.on('entry', function(header, stream, next) {
        let name, key;

        if (header.type === 'file') {
            ({name, key} = getFileName(header.name));
        }
        else if (header.type === 'directory') {
            // directory entries in tar often end with directory separator
            name = (header.name.endsWith("/") || header.name.endsWith("\\")) ? header.name.substr(0, header.name.length - 1) : header.name;
            key = 'directory';
        }
        else {
            log.error("Unrecognized tar entry: " + JSON.stringify(header));
            return;
        }

        let file = fileMap[name];

        if (!file) {
            file = fileMap[name] = {
                name: path.basename(name),
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

async function importNotes(ctx, files, parentNoteId) {
    let returnNote = null;

    for (const file of files) {
        let note;

        if (!file.meta) {
            let content = '';

            if (file.data) {
                content = file.data.toString("UTF-8");
            }
            else if (file.markdown) {
                const parsed = ctx.reader.parse(file.markdown.toString("UTF-8"));
                content = ctx.writer.render(parsed);
            }

            note = (await noteService.createNote(parentNoteId, file.name, content, {
                type: 'text',
                mime: 'text/html'
            })).note;
        }
        else {
            if (file.meta.version !== 1) {
                throw new Error("Can't read meta data version " + file.meta.version);
            }

            if (file.meta.clone) {
                await new Branch({
                    parentNoteId: parentNoteId,
                    noteId: ctx.noteIdMap[file.meta.noteId],
                    prefix: file.meta.prefix
                }).save();

                return;
            }

            if (file.meta.type !== 'file') {
                file.data = file.data.toString("UTF-8");
            }

            note = (await noteService.createNote(parentNoteId, file.meta.title, file.data, {
                type: file.meta.type,
                mime: file.meta.mime,
                prefix: file.meta.prefix
            })).note;

            ctx.noteIdMap[file.meta.noteId] = note.noteId;

            for (const attribute of file.meta.attributes) {
                ctx.attributes.push({
                    noteId: note.noteId,
                    type: attribute.type,
                    name: attribute.name,
                    value: attribute.value,
                    isInheritable: attribute.isInheritable,
                    position: attribute.position
                });
            }
        }

        // first created note will be activated after import
        returnNote = returnNote || note;

        if (file.children.length > 0) {
            await importNotes(ctx, file.children, note.noteId);
        }
    }

    return returnNote;
}

async function importMarkdown(file, parentNoteId) {
    const markdownContent = file.buffer.toString("UTF-8");

    const reader = new commonmark.Parser();
    const writer = new commonmark.HtmlRenderer();

    const parsed = reader.parse(markdownContent);
    const htmlContent = writer.render(parsed);

    const title = file.originalname.substr(0, file.originalname.length - 3); // strip .md extension

    const {note} = await noteService.createNote(parentNoteId, title, htmlContent, {
        type: 'text',
        mime: 'text/html'
    });

    return note;
}

module.exports = {
    importToBranch
};