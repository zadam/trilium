const sax = require("sax");
const stream = require('stream');
const xml2js = require('xml2js');
const log = require("../log");
const utils = require("../utils");
const noteService = require("../notes");
const imageService = require("../image");

// date format is e.g. 20181121T193703Z
function parseDate(text) {
    // insert - and : to make it ISO format
    text = text.substr(0, 4) + "-" + text.substr(4, 2) + "-" + text.substr(6, 2)
        + "T" + text.substr(9, 2) + ":" + text.substr(11, 2) + ":" + text.substr(13, 2) + "Z";

    return text;
}

let note = {};
let resource;

async function importEnex(file, parentNote) {
    const saxStream = sax.createStream(true);
    const xmlBuilder = new xml2js.Builder({ headless: true });
    const parser = new xml2js.Parser({ explicitArray: true });

    const rootNoteTitle = file.originalname.toLowerCase().endsWith(".enex")
        ? file.originalname.substr(0, file.originalname.length - 5)
        : file.originalname;

    // root note is new note into all ENEX/notebook's notes will be imported
    const rootNote = (await noteService.createNote(parentNote.noteId, rootNoteTitle, "", {
        type: 'text',
        mime: 'text/html'
    })).note;

    // we're persisting notes as we parse the document, but these are run asynchronously and may not be finished
    // when we finish parsing. We use this to be sure that all saving has been finished before returning successfully.
    const saveNotePromises = [];

    async function parseXml(text) {
        return new Promise(function(resolve, reject)
        {
            parser.parseString(text, function (err, result) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(result);
                }
            });
        });
    }

    function extractContent(enNote) {
        // [] thing is workaround for https://github.com/Leonidas-from-XIV/node-xml2js/issues/484
        let content = xmlBuilder.buildObject([enNote]);
        content = content.substr(3, content.length - 7).trim();

        // workaround for https://github.com/ckeditor/ckeditor5-list/issues/116
        content = content.replace(/<li>\s+<div>/g, "<li>");
        content = content.replace(/<\/div>\s+<\/li>/g, "</li>");

        // workaround for https://github.com/ckeditor/ckeditor5-list/issues/115
        content = content.replace(/<ul>\s+<ul>/g, "<ul><li><ul>");
        content = content.replace(/<\/li>\s+<ul>/g, "<ul>");
        content = content.replace(/<\/ul>\s+<\/ul>/g, "</ul></li></ul>");
        content = content.replace(/<\/ul>\s+<li>/g, "</ul></li><li>");

        content = content.replace(/<ol>\s+<ol>/g, "<ol><li><ol>");
        content = content.replace(/<\/li>\s+<ol>/g, "<ol>");
        content = content.replace(/<\/ol>\s+<\/ol>/g, "</ol></li></ol>");
        content = content.replace(/<\/ol>\s+<li>/g, "</ol></li><li>");

        return content;
    }


    const path = [];

    function getCurrentTag() {
        if (path.length >= 1) {
            return path[path.length - 1];
        }
    }

    function getPreviousTag() {
        if (path.length >= 2) {
            return path[path.length - 2];
        }
    }

    saxStream.on("error", e => {
        // unhandled errors will throw, since this is a proper node
        // event emitter.
        log.error("error when parsing ENEX file: " + e);
        // clear the error
        this._parser.error = null;
        this._parser.resume();
    });

    saxStream.on("text", text => {
        const currentTag = getCurrentTag();
        const previousTag = getPreviousTag();

        if (previousTag === 'note-attributes') {
            note.attributes.push({
                type: 'label',
                name: currentTag,
                value: text
            });
        }
        else if (previousTag === 'resource-attributes') {
            if (currentTag === 'file-name') {
                resource.attributes.push({
                    type: 'label',
                    name: 'originalFileName',
                    value: text
                });

                resource.title = text;
            }
            else if (currentTag === 'source-url') {
                resource.attributes.push({
                    type: 'label',
                    name: 'sourceUrl',
                    value: text
                });
            }
        }
        else if (previousTag === 'resource') {
            if (currentTag === 'data') {
                text = text.replace(/\s/g, '');

                resource.content = utils.fromBase64(text);

                resource.attributes.push({
                    type: 'label',
                    name: 'fileSize',
                    value: resource.content.length
                });
            }
            else if (currentTag === 'mime') {
                resource.mime = text;

                if (text.startsWith("image/")) {
                    resource.title = "image";

                    // images don't have "file-name" tag so we'll create attribute here
                    resource.attributes.push({
                        type: 'label',
                        name: 'originalFileName',
                        value: resource.title + "." + text.substr(6) // extension from mime type
                    });
                }
            }
        }
        else if (previousTag === 'note') {
            if (currentTag === 'title') {
                note.title = text;
            } else if (currentTag === 'created') {
                note.dateCreated = parseDate(text);
            } else if (currentTag === 'updated') {
                // updated is currently ignored since dateModified is updated automatically with each save
            } else if (currentTag === 'tag') {
                note.attributes.push({
                    type: 'label',
                    name: text,
                    value: ''
                })
            }
            // unknown tags are just ignored
        }
    });

    saxStream.on("attribute", attr => {
        // an attribute.  attr has "name" and "value"
    });

    saxStream.on("opentag", tag => {
        path.push(tag.name);

        if (tag.name === 'note') {
            note = {
                content: "",
                // it's an array, not a key-value object because we don't know if attributes can be duplicated
                attributes: [],
                resources: []
            };
        }
        else if (tag.name === 'resource') {
            resource = {
                title: "resource",
                attributes: []
            };

            note.resources.push(resource);
        }
    });

    async function saveNote() {
        // make a copy because stream continues with the next async call and note gets overwritten
        let {title, content, attributes, resources, dateCreated} = note;

        const xmlObject = await parseXml(content);

        // following is workaround for this issue: https://github.com/Leonidas-from-XIV/node-xml2js/issues/484
        content = extractContent(xmlObject['en-note']);

        const noteEntity = (await noteService.createNote(rootNote.noteId, title, content, {
            attributes,
            dateCreated,
            type: 'text',
            mime: 'text/html'
        })).note;

        for (const resource of resources) {
            const hash = utils.md5(resource.content);

            const mediaRegex = new RegExp(`<en-media hash="${hash}"[^>]*>`, 'g');

            if (resource.mime.startsWith("image/")) {
                const originalName = "image." + resource.mime.substr(6);

                const { url } = await imageService.saveImage(resource.content, originalName, noteEntity.noteId);

                const imageLink = `<img src="${url}">`;

                noteEntity.content = noteEntity.content.replace(mediaRegex, imageLink);

                if (!note.content.includes(imageLink)) {
                    // if there wasn't any match for the reference, we'll add the image anyway
                    // otherwise image would be removed since no note would include it
                    note.content += imageLink;
                }
            }
            else {
                const resourceNote = (await noteService.createNote(noteEntity.noteId, resource.title, resource.content, {
                    attributes: resource.attributes,
                    type: 'file',
                    mime: resource.mime
                })).note;

                const resourceLink = `<a href="#root/${resourceNote.noteId}">${utils.escapeHtml(resource.title)}</a>`;

                noteEntity.content = noteEntity.content.replace(mediaRegex, resourceLink);
            }
        }

        // save updated content with links to files/images
        await noteEntity.save();
    }

    saxStream.on("closetag", async tag => {
        path.pop();

        if (tag === 'note') {
            saveNotePromises.push(saveNote());
        }
    });

    saxStream.on("opencdata", () => {
        //console.log("opencdata");
    });

    saxStream.on("cdata", text => {
        note.content += text;
    });

    saxStream.on("closecdata", () => {
        //console.log("closecdata");
    });

    return new Promise((resolve, reject) =>
    {
        // resolve only when we parse the whole document AND saving of all notes have been finished
        saxStream.on("end", () => { Promise.all(saveNotePromises).then(() => resolve(rootNote)) });

        const bufferStream = new stream.PassThrough();
        bufferStream.end(file.buffer);

        bufferStream.pipe(saxStream);
    });
}

module.exports = { importEnex };