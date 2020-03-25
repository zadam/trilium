const sax = require("sax");
const FileType = require('file-type');
const stream = require('stream');
const log = require("../log");
const utils = require("../utils");
const sql = require("../sql");
const noteService = require("../notes");
const imageService = require("../image");
const protectedSessionService = require('../protected_session');

// date format is e.g. 20181121T193703Z
function parseDate(text) {
    // insert - and : to make it ISO format
    text = text.substr(0, 4) + "-" + text.substr(4, 2) + "-" + text.substr(6, 2)
        + " " + text.substr(9, 2) + ":" + text.substr(11, 2) + ":" + text.substr(13, 2) + ".000Z";

    return text;
}

let note = {};
let resource;

async function importEnex(taskContext, file, parentNote) {
    const saxStream = sax.createStream(true);

    const rootNoteTitle = file.originalname.toLowerCase().endsWith(".enex")
        ? file.originalname.substr(0, file.originalname.length - 5)
        : file.originalname;

    // root note is new note into all ENEX/notebook's notes will be imported
    const rootNote = (await noteService.createNewNote({
        parentNoteId: parentNote.noteId,
        title: rootNoteTitle,
        content: "",
        type: 'text',
        mime: 'text/html',
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
    })).note;

    // we're persisting notes as we parse the document, but these are run asynchronously and may not be finished
    // when we finish parsing. We use this to be sure that all saving has been finished before returning successfully.
    const saveNotePromises = [];

    function extractContent(content) {
        const openingNoteIndex = content.indexOf('<en-note>');

        if (openingNoteIndex !== -1) {
            content = content.substr(openingNoteIndex + 9);
        }

        const closingNoteIndex = content.lastIndexOf('</en-note>');

        if (closingNoteIndex !== -1) {
            content = content.substr(0, closingNoteIndex);
        }

        content = content.trim();

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
                note.utcDateModified = parseDate(text);
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

    async function updateDates(noteId, utcDateCreated, utcDateModified) {
        // it's difficult to force custom dateCreated and dateModified to Note entity so we do it post-creation with SQL
        await sql.execute(`
                UPDATE notes 
                SET dateCreated = ?, 
                    utcDateCreated = ?,
                    dateModified = ?,
                    utcDateModified = ?
                WHERE noteId = ?`,
            [utcDateCreated, utcDateCreated, utcDateModified, utcDateModified, noteId]);

        await sql.execute(`
                UPDATE note_contents
                SET utcDateModified = ?
                WHERE noteId = ?`,
            [utcDateModified, noteId]);
    }

    async function saveNote() {
        // make a copy because stream continues with the next async call and note gets overwritten
        let {title, content, attributes, resources, utcDateCreated, utcDateModified} = note;

        content = extractContent(content);

        const noteEntity = (await noteService.createNewNote({
            parentNoteId: rootNote.noteId,
            title,
            content,
            utcDateCreated,
            type: 'text',
            mime: 'text/html',
            isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
        })).note;

        for (const attr of attributes) {
            await noteEntity.addAttribute(attr.type, attr.name, attr.value);
        }

        utcDateCreated = utcDateCreated || noteEntity.utcDateCreated;
        // sometime date modified is not present in ENEX, then use date created
        utcDateModified = utcDateModified || utcDateCreated;

        taskContext.increaseProgressCount();

        for (const resource of resources) {
            const hash = utils.md5(resource.content);

            const mediaRegex = new RegExp(`<en-media hash="${hash}"[^>]*>`, 'g');

            const fileTypeFromBuffer = await FileType.fromBuffer(resource.content);
            if (fileTypeFromBuffer) {
              // If fileType returns something for buffer, then set the mime given
              resource.mime = fileTypeFromBuffer.mime;
            }

            const createFileNote = async () => {
                const resourceNote = (await noteService.createNewNote({
                    parentNoteId: noteEntity.noteId,
                    title: resource.title,
                    content: resource.content,
                    type: 'file',
                    mime: resource.mime,
                    isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
                })).note;

                for (const attr of resource.attributes) {
                    await noteEntity.addAttribute(attr.type, attr.name, attr.value);
                }

                await updateDates(resourceNote.noteId, utcDateCreated, utcDateModified);

                taskContext.increaseProgressCount();

                const resourceLink = `<a href="#root/${resourceNote.noteId}">${utils.escapeHtml(resource.title)}</a>`;

                content = content.replace(mediaRegex, resourceLink);
            };

            if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(resource.mime)) {
                try {
                    const originalName = "image." + resource.mime.substr(6);

                    const {url, note: imageNote} = await imageService.saveImage(noteEntity.noteId, resource.content, originalName, taskContext.data.shrinkImages);

                    await updateDates(imageNote.noteId, utcDateCreated, utcDateModified);

                    const imageLink = `<img src="${url}">`;

                    content = content.replace(mediaRegex, imageLink);

                    if (!content.includes(imageLink)) {
                        // if there wasn't any match for the reference, we'll add the image anyway
                        // otherwise image would be removed since no note would include it
                        content += imageLink;
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
        await noteEntity.setContent(content);

        await noteService.scanForLinks(noteEntity);

        await updateDates(noteEntity.noteId, utcDateCreated, utcDateModified);
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