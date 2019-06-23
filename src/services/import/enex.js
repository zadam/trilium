const sax = require("sax");
const fileType = require('file-type');
const stream = require('stream');
const xml2js = require('xml2js');
const log = require("../log");
const utils = require("../utils");
const noteService = require("../notes");
const imageService = require("../image");
const protectedSessionService = require('../protected_session');

// date format is e.g. 20181121T193703Z
function parseDate(text) {
    // insert - and : to make it ISO format
    text = text.substr(0, 4) + "-" + text.substr(4, 2) + "-" + text.substr(6, 2)
        + "T" + text.substr(9, 2) + ":" + text.substr(11, 2) + ":" + text.substr(13, 2) + "Z";

    return text;
}

let note = {};
let resource;

async function importEnex(importContext, file, parentNote) {
    const saxStream = sax.createStream(true);
    const xmlBuilder = new xml2js.Builder({ headless: true });
    const parser = new xml2js.Parser({ explicitArray: true });

    const rootNoteTitle = file.originalname.toLowerCase().endsWith(".enex")
        ? file.originalname.substr(0, file.originalname.length - 5)
        : file.originalname;

    // root note is new note into all ENEX/notebook's notes will be imported
    const rootNote = (await noteService.createNote(parentNote.noteId, rootNoteTitle, "", {
        type: 'text',
        mime: 'text/html',
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
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

        const endOfFirstTagIndex = content.indexOf('>');

        // strip the <0> and </0> tags
        content = content.substr(endOfFirstTagIndex + 1, content.length - endOfFirstTagIndex - 5).trim();

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
                resource.mime = text.toLowerCase();

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
                note.utcDateCreated = parseDate(text);
            } else if (currentTag === 'updated') {
                // updated is currently ignored since utcDateModified is updated automatically with each save
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
        let {title, content, attributes, resources, utcDateCreated} = note;

        const xmlObject = await parseXml(content);

        // following is workaround for this issue: https://github.com/Leonidas-from-XIV/node-xml2js/issues/484
        content = extractContent(xmlObject['en-note']);

        const noteEntity = (await noteService.createNote(rootNote.noteId, title, content, {
            attributes,
            utcDateCreated,
            type: 'text',
            mime: 'text/html',
            isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
        })).note;

        importContext.increaseProgressCount();

        let noteContent = await noteEntity.getContent();

        for (const resource of resources) {
            const hash = utils.md5(resource.content);

            const mediaRegex = new RegExp(`<en-media hash="${hash}"[^>]*>`, 'g');

            const fileTypeFromBuffer = fileType(resource.content);
            if (fileTypeFromBuffer) {
              // If fileType returns something for buffer, then set the mime given
              resource.mime = fileTypeFromBuffer.mime;
            }

            const createFileNote = async () => {
                const resourceNote = (await noteService.createNote(noteEntity.noteId, resource.title, resource.content, {
                    attributes: resource.attributes,
                    type: 'file',
                    mime: resource.mime,
                    isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
                })).note;

                importContext.increaseProgressCount();

                const resourceLink = `<a href="#root/${resourceNote.noteId}">${utils.escapeHtml(resource.title)}</a>`;

                noteContent = noteContent.replace(mediaRegex, resourceLink);
            };

            if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(resource.mime)) {
                try {
                    const originalName = "image." + resource.mime.substr(6);

                    const {url} = await imageService.saveImage(resource.content, originalName, noteEntity.noteId, importContext.shrinkImages);

                    const imageLink = `<img src="${url}">`;

                    noteContent = noteContent.replace(mediaRegex, imageLink);

                    if (!noteContent.includes(imageLink)) {
                        // if there wasn't any match for the reference, we'll add the image anyway
                        // otherwise image would be removed since no note would include it
                        noteContent += imageLink;
                    }
                } catch (e) {
                    log.error("error when saving image from ENEX file: " + e);
                    await createFileNote();
                }
            } else {
                await createFileNote();
            }
        }

        // save updated content with links to files/images
        await noteEntity.setContent(noteContent);
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