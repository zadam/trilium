const sql = require('./sql');
const sqlInit = require('./sql_init');
const optionService = require('./options');
const dateUtils = require('./date_utils');
const entityChangesService = require('./entity_changes.js');
const eventService = require('./events');
const repository = require('./repository');
const cls = require('../services/cls');
const Note = require('../entities/note');
const NoteRevision = require('../entities/note_revision');
const Branch = require('../entities/branch');
const Attribute = require('../entities/attribute');
const hoistedNoteService = require('../services/hoisted_note');
const protectedSessionService = require('../services/protected_session');
const log = require('../services/log');
const utils = require('../services/utils');
const noteRevisionService = require('../services/note_revisions');
const attributeService = require('../services/attributes');
const request = require('./request');
const path = require('path');
const url = require('url');

function getNewNotePosition(parentNoteId) {
    const maxNotePos = sql.getValue(`
            SELECT MAX(notePosition) 
            FROM branches 
            WHERE parentNoteId = ? 
              AND isDeleted = 0`, [parentNoteId]);

    return maxNotePos === null ? 0 : maxNotePos + 10;
}

function triggerChildNoteCreated(childNote, parentNote) {
    eventService.emit(eventService.CHILD_NOTE_CREATED, { childNote, parentNote });
}

function triggerNoteTitleChanged(note) {
    eventService.emit(eventService.NOTE_TITLE_CHANGED, note);
}

function deriveMime(type, mime) {
    if (!type) {
        throw new Error(`Note type is a required param`);
    }

    if (mime) {
        return mime;
    }

    if (type === 'text') {
        mime = 'text/html';
    } else if (type === 'code') {
        mime = 'text/plain';
    } else if (['relation-map', 'search'].includes(type)) {
        mime = 'application/json';
    } else if (['render', 'book'].includes(type)) {
        mime = '';
    } else {
        mime = 'application/octet-stream';
    }

    return mime;
}

function copyChildAttributes(parentNote, childNote) {
    for (const attr of parentNote.getAttributes()) {
        if (attr.name.startsWith("child:")) {
            new Attribute({
                noteId: childNote.noteId,
                type: attr.type,
                name: attr.name.substr(6),
                value: attr.value,
                position: attr.position,
                isInheritable: attr.isInheritable
            }).save();

            childNote.invalidateAttributeCache();
        }
    }
}

/**
 * Following object properties are mandatory:
 * - {string} parentNoteId
 * - {string} title
 * - {*} content
 * - {string} type - text, code, file, image, search, book, relation-map, render
 *
 * Following are optional (have defaults)
 * - {string} mime - value is derived from default mimes for type
 * - {boolean} isProtected - default is false
 * - {boolean} isExpanded - default is false
 * - {string} prefix - default is empty string
 * - {integer} notePosition - default is last existing notePosition in a parent + 10
 *
 * @param params
 * @return {{note: Note, branch: Branch}}
 */
function createNewNote(params) {
    const parentNote = repository.getNote(params.parentNoteId);

    if (!parentNote) {
        throw new Error(`Parent note "${params.parentNoteId}" not found.`);
    }

    if (!params.title || params.title.trim().length === 0) {
        throw new Error(`Note title must not be empty`);
    }

    return sql.transactional(() => {
        const note = new Note({
            noteId: params.noteId, // optionally can force specific noteId
            title: params.title,
            isProtected: !!params.isProtected,
            type: params.type,
            mime: deriveMime(params.type, params.mime)
        }).save();

        note.setContent(params.content);

        const branch = new Branch({
            noteId: note.noteId,
            parentNoteId: params.parentNoteId,
            notePosition: params.notePosition !== undefined ? params.notePosition : getNewNotePosition(params.parentNoteId),
            prefix: params.prefix,
            isExpanded: !!params.isExpanded
        }).save();

        scanForLinks(note);

        copyChildAttributes(parentNote, note);

        triggerNoteTitleChanged(note);
        triggerChildNoteCreated(note, parentNote);

        return {
            note,
            branch
        };
    });
}

function createNewNoteWithTarget(target, targetBranchId, params) {
    if (!params.type) {
        const parentNote = repository.getNote(params.parentNoteId);

        // code note type can be inherited, otherwise text is default
        params.type = parentNote.type === 'code' ? 'code' : 'text';
        params.mime = parentNote.type === 'code' ? parentNote.mime : 'text/html';
    }

    if (target === 'into') {
        return createNewNote(params);
    }
    else if (target === 'after') {
        const afterNote = sql.getRow('SELECT notePosition FROM branches WHERE branchId = ?', [targetBranchId]);

        // not updating utcDateModified to avoig having to sync whole rows
        sql.execute('UPDATE branches SET notePosition = notePosition + 10 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0',
            [params.parentNoteId, afterNote.notePosition]);

        params.notePosition = afterNote.notePosition + 10;

        const retObject = createNewNote(params);

        entityChangesService.addNoteReorderingEntityChange(params.parentNoteId);

        return retObject;
    }
    else {
        throw new Error(`Unknown target ${target}`);
    }
}

function protectNoteRecursively(note, protect, includingSubTree, taskContext) {
    protectNote(note, protect);

    taskContext.increaseProgressCount();

    if (includingSubTree) {
        for (const child of note.getChildNotes()) {
            protectNoteRecursively(child, protect, includingSubTree, taskContext);
        }
    }
}

function protectNote(note, protect) {
    if (protect !== note.isProtected) {
        const content = note.getContent();

        note.isProtected = protect;

        // this will force de/encryption
        note.setContent(content);

        note.save();
    }

    noteRevisionService.protectNoteRevisions(note);
}

function findImageLinks(content, foundLinks) {
    const re = /src="[^"]*api\/images\/([a-zA-Z0-9]+)\//g;
    let match;

    while (match = re.exec(content)) {
        foundLinks.push({
            name: 'imageLink',
            value: match[1]
        });
    }

    // removing absolute references to server to keep it working between instances
    // we also omit / at the beginning to keep the paths relative
    return content.replace(/src="[^"]*\/api\/images\//g, 'src="api/images/');
}

function findInternalLinks(content, foundLinks) {
    const re = /href="[^"]*#root[a-zA-Z0-9\/]*\/([a-zA-Z0-9]+)\/?"/g;
    let match;

    while (match = re.exec(content)) {
        foundLinks.push({
            name: 'internalLink',
            value: match[1]
        });
    }

    // removing absolute references to server to keep it working between instances
    return content.replace(/href="[^"]*#root/g, 'href="#root');
}

function findIncludeNoteLinks(content, foundLinks) {
    const re = /<section class="include-note[^>]+data-note-id="([a-zA-Z0-9]+)"[^>]*>/g;
    let match;

    while (match = re.exec(content)) {
        foundLinks.push({
            name: 'includeNoteLink',
            value: match[1]
        });
    }

    return content;
}

function findRelationMapLinks(content, foundLinks) {
    const obj = JSON.parse(content);

    for (const note of obj.notes) {
        foundLinks.push({
            name: 'relationMapLink',
            value: note.noteId
        });
    }
}

const imageUrlToNoteIdMapping = {};

async function downloadImage(noteId, imageUrl) {
    try {
        const imageBuffer = await request.getImage(imageUrl);
        const parsedUrl = url.parse(imageUrl);
        const title = path.basename(parsedUrl.pathname);

        const imageService = require('../services/image');
        const {note} = imageService.saveImage(noteId, imageBuffer, title, true);

        note.addLabel('imageUrl', imageUrl);

        imageUrlToNoteIdMapping[imageUrl] = note.noteId;

        log.info(`Download of ${imageUrl} succeeded and was saved as image note ${note.noteId}`);
    }
    catch (e) {
        log.error(`Download of ${imageUrl} for note ${noteId} failed with error: ${e.message} ${e.stack}`);
    }
}

/** url => download promise */
const downloadImagePromises = {};

function replaceUrl(content, url, imageNote) {
    const quotedUrl = utils.quoteRegex(url);

    return content.replace(new RegExp(`\\s+src=[\"']${quotedUrl}[\"']`, "ig"), ` src="api/images/${imageNote.noteId}/${imageNote.title}"`);
}

function downloadImages(noteId, content) {
    const imageRe = /<img[^>]*?\ssrc=['"]([^'">]+)['"]/ig;
    let imageMatch;

    while (imageMatch = imageRe.exec(content)) {
        const url = imageMatch[1];
        const inlineImageMatch = /^data:image\/[a-z]+;base64,/.exec(url);

        if (inlineImageMatch) {
            const imageBase64 = url.substr(inlineImageMatch[0].length);
            const imageBuffer = Buffer.from(imageBase64, 'base64');

            const imageService = require('../services/image');
            const {note} = imageService.saveImage(noteId, imageBuffer, "inline image", true);

            content = content.substr(0, imageMatch.index)
                + `<img src="api/images/${note.noteId}/${note.title}"`
                + content.substr(imageMatch.index + imageMatch[0].length);
        }
        else if (!url.includes('api/images/')
            // this is an exception for the web clipper's "imageId"
            && (url.length !== 20 || url.toLowerCase().startsWith('http'))) {

            if (url in imageUrlToNoteIdMapping) {
                const imageNote = repository.getNote(imageUrlToNoteIdMapping[url]);

                if (!imageNote || imageNote.isDeleted) {
                    delete imageUrlToNoteIdMapping[url];
                }
                else {
                    content = replaceUrl(content, url, imageNote);
                    continue;
                }
            }

            const existingImage = (attributeService.getNotesWithLabel('imageUrl', url))
                .find(note => note.type === 'image');

            if (existingImage) {
                imageUrlToNoteIdMapping[url] = existingImage.noteId;

                content = replaceUrl(content, url, existingImage);
                continue;
            }

            if (url in downloadImagePromises) {
                // download is already in progress
                continue;
            }

            // this is done asynchronously, it would be too slow to wait for the download
            // given that save can be triggered very often
            downloadImagePromises[url] = downloadImage(noteId, url);
        }
    }

    Promise.all(Object.values(downloadImagePromises)).then(() => {
        setTimeout(() => {
            // the normal expected flow of the offline image saving is that users will paste the image(s)
            // which will get asynchronously downloaded, during that time they keep editing the note
            // once the download is finished, the image note representing downloaded image will be used
            // to replace the IMG link.
            // However there's another flow where user pastes the image and leaves the note before the images
            // are downloaded and the IMG references are not updated. For this occassion we have this code
            // which upon the download of all the images will update the note if the links have not been fixed before

            sql.transactional(() => {
                const imageNotes = repository.getNotes(Object.values(imageUrlToNoteIdMapping));

                const origNote = repository.getNote(noteId);
                const origContent = origNote.getContent();
                let updatedContent = origContent;

                for (const url in imageUrlToNoteIdMapping) {
                    const imageNote = imageNotes.find(note => note.noteId === imageUrlToNoteIdMapping[url]);

                    if (imageNote && !imageNote.isDeleted) {
                        updatedContent = replaceUrl(updatedContent, url, imageNote);
                    }
                }

                // update only if the links have not been already fixed.
                if (updatedContent !== origContent) {
                    origNote.setContent(updatedContent);

                    scanForLinks(origNote);

                    console.log(`Fixed the image links for note ${noteId} to the offline saved.`);
                }
            });
        }, 5000);
    });

    return content;
}

function saveLinks(note, content) {
    if (note.type !== 'text' && note.type !== 'relation-map') {
        return content;
    }

    if (note.isProtected && !protectedSessionService.isProtectedSessionAvailable()) {
        return content;
    }

    const foundLinks = [];

    if (note.type === 'text') {
        content = downloadImages(note.noteId, content);

        content = findImageLinks(content, foundLinks);
        content = findInternalLinks(content, foundLinks);
        content = findIncludeNoteLinks(content, foundLinks);
    }
    else if (note.type === 'relation-map') {
        findRelationMapLinks(content, foundLinks);
    }
    else {
        throw new Error("Unrecognized type " + note.type);
    }

    const existingLinks = note.getLinks();

    for (const foundLink of foundLinks) {
        const targetNote = repository.getNote(foundLink.value);
        if (!targetNote || targetNote.isDeleted) {
            continue;
        }

        const existingLink = existingLinks.find(existingLink =>
            existingLink.value === foundLink.value
            && existingLink.name === foundLink.name);

        if (!existingLink) {
            const newLink = new Attribute({
                noteId: note.noteId,
                type: 'relation',
                name: foundLink.name,
                value: foundLink.value,
            }).save();

            existingLinks.push(newLink);
        }
        else if (existingLink.isDeleted) {
            existingLink.isDeleted = false;
            existingLink.save();
        }
        // else the link exists so we don't need to do anything
    }

    // marking links as deleted if they are not present on the page anymore
    const unusedLinks = existingLinks.filter(existingLink => !foundLinks.some(foundLink =>
                                    existingLink.value === foundLink.value
                                    && existingLink.name === foundLink.name));

    for (const unusedLink of unusedLinks) {
        unusedLink.isDeleted = true;
        unusedLink.save();
    }

    return content;
}

function saveNoteRevision(note) {
    // files and images are versioned separately
    if (note.type === 'file' || note.type === 'image' || note.hasLabel('disableVersioning')) {
        return;
    }

    const now = new Date();
    const noteRevisionSnapshotTimeInterval = parseInt(optionService.getOption('noteRevisionSnapshotTimeInterval'));

    const revisionCutoff = dateUtils.utcDateStr(new Date(now.getTime() - noteRevisionSnapshotTimeInterval * 1000));

    const existingNoteRevisionId = sql.getValue(
        "SELECT noteRevisionId FROM note_revisions WHERE noteId = ? AND utcDateCreated >= ?", [note.noteId, revisionCutoff]);

    const msSinceDateCreated = now.getTime() - dateUtils.parseDateTime(note.utcDateCreated).getTime();

    if (!existingNoteRevisionId && msSinceDateCreated >= noteRevisionSnapshotTimeInterval * 1000) {
        noteRevisionService.createNoteRevision(note);
    }
}

function updateNote(noteId, noteUpdates) {
    const note = repository.getNote(noteId);

    if (!note.isContentAvailable) {
        throw new Error(`Note ${noteId} is not available for change!`);
    }

    saveNoteRevision(note);

    // if protected status changed, then we need to encrypt/decrypt the content anyway
    if (['file', 'image'].includes(note.type) && note.isProtected !== noteUpdates.isProtected) {
        noteUpdates.content = note.getContent();
    }

    const noteTitleChanged = note.title !== noteUpdates.title;

    note.title = noteUpdates.title;
    note.isProtected = noteUpdates.isProtected;
    note.save();

    if (noteUpdates.content !== undefined && noteUpdates.content !== null) {
        noteUpdates.content = saveLinks(note, noteUpdates.content);

        note.setContent(noteUpdates.content);
    }

    if (noteTitleChanged) {
        triggerNoteTitleChanged(note);
    }

    noteRevisionService.protectNoteRevisions(note);

    return {
        dateModified: note.dateModified,
        utcDateModified: note.utcDateModified
    };
}

/**
 * @param {Branch} branch
 * @param {string} deleteId
 * @param {TaskContext} taskContext
 *
 * @return {boolean} - true if note has been deleted, false otherwise
 */
function deleteBranch(branch, deleteId, taskContext) {
    taskContext.increaseProgressCount();

    if (!branch || branch.isDeleted) {
        return false;
    }

    if (branch.branchId === 'root'
        || branch.noteId === 'root'
        || branch.noteId === hoistedNoteService.getHoistedNoteId()) {

        throw new Error("Can't delete root branch/note");
    }

    branch.isDeleted = true;
    branch.deleteId = deleteId;
    branch.save();

    const note = branch.getNote();
    const notDeletedBranches = note.getBranches();

    if (notDeletedBranches.length === 0) {
        for (const childBranch of note.getChildBranches()) {
            deleteBranch(childBranch, deleteId, taskContext);
        }

        // first delete children and then parent - this will show up better in recent changes

        note.isDeleted = true;
        note.deleteId = deleteId;
        note.save();

        log.info("Deleting note " + note.noteId);

        for (const attribute of note.getOwnedAttributes()) {
            attribute.isDeleted = true;
            attribute.deleteId = deleteId;
            attribute.save();
        }

        for (const relation of note.getTargetRelations()) {
            relation.isDeleted = true;
            relation.deleteId = deleteId;
            relation.save();
        }

        return true;
    }
    else {
        return false;
    }
}

/**
 * @param {Note} note
 * @param {string} deleteId
 * @param {TaskContext} taskContext
 */
function undeleteNote(note, deleteId, taskContext) {
    const undeletedParentBranches = getUndeletedParentBranches(note.noteId, deleteId);

    if (undeletedParentBranches.length === 0) {
        // cannot undelete if there's no undeleted parent
        return;
    }

    for (const parentBranch of undeletedParentBranches) {
        undeleteBranch(parentBranch, deleteId, taskContext);
    }
}

/**
 * @param {Branch} branch
 * @param {string} deleteId
 * @param {TaskContext} taskContext
 */
function undeleteBranch(branch, deleteId, taskContext) {
    if (!branch.isDeleted) {
        return;
    }

    const note = branch.getNote();

    if (note.isDeleted && note.deleteId !== deleteId) {
        return;
    }

    branch.isDeleted = false;
    branch.save();

    taskContext.increaseProgressCount();

    if (note.isDeleted && note.deleteId === deleteId) {
        note.isDeleted = false;
        note.save();

        const attrs = repository.getEntities(`
                SELECT * FROM attributes 
                WHERE isDeleted = 1 
                  AND deleteId = ? 
                  AND (noteId = ? 
                           OR (type = 'relation' AND value = ?))`, [deleteId, note.noteId, note.noteId]);

        for (const attr of attrs) {
            attr.isDeleted = false;
            attr.save();
        }

        const childBranches = repository.getEntities(`
            SELECT branches.*
            FROM branches
            WHERE branches.isDeleted = 1
              AND branches.deleteId = ?
              AND branches.parentNoteId = ?`, [deleteId, note.noteId]);

        for (const childBranch of childBranches) {
            undeleteBranch(childBranch, deleteId, taskContext);
        }
    }
}

/**
 * @return return deleted branches of an undeleted parent note
 */
function getUndeletedParentBranches(noteId, deleteId) {
    return repository.getEntities(`
                    SELECT branches.*
                    FROM branches
                    JOIN notes AS parentNote ON parentNote.noteId = branches.parentNoteId
                    WHERE branches.noteId = ?
                      AND branches.isDeleted = 1
                      AND branches.deleteId = ?
                      AND parentNote.isDeleted = 0`, [noteId, deleteId]);
}

function scanForLinks(note) {
    if (!note || !['text', 'relation-map'].includes(note.type)) {
        return;
    }

    try {
        const content = note.getContent();
        const newContent = saveLinks(note, content);

        if (content !== newContent) {
            note.setContent(newContent);
        }
    }
    catch (e) {
        log.error(`Could not scan for links note ${note.noteId}: ${e.message} ${e.stack}`);
    }
}

function eraseDeletedNotes() {
    const eraseNotesAfterTimeInSeconds = optionService.getOptionInt('eraseNotesAfterTimeInSeconds');

    const cutoffDate = new Date(Date.now() - eraseNotesAfterTimeInSeconds * 1000);

    const noteIdsToErase = sql.getColumn("SELECT noteId FROM notes WHERE isDeleted = 1 AND isErased = 0 AND notes.utcDateModified <= ?", [dateUtils.utcDateStr(cutoffDate)]);

    if (noteIdsToErase.length === 0) {
        return;
    }

    // it's better to not use repository for this because:
    // - it would complain about saving protected notes out of protected session
    // - we don't want these changes to be synced (since they are done on all instances anyway)
    // - we don't want change the hash since this erasing happens on each instance separately
    //   and changing the hash would fire up the sync errors temporarily

    sql.executeMany(`
        UPDATE notes 
        SET title = '[deleted]',
            isProtected = 0,
            isErased = 1
        WHERE noteId IN (???)`, noteIdsToErase);

    sql.executeMany(`
        UPDATE note_contents 
        SET content = NULL 
        WHERE noteId IN (???)`, noteIdsToErase);

    // deleting first contents since the WHERE relies on isErased = 0
    sql.executeMany(`
        UPDATE note_revision_contents
        SET content = NULL
        WHERE noteRevisionId IN 
            (SELECT noteRevisionId FROM note_revisions WHERE isErased = 0 AND noteId IN (???))`, noteIdsToErase);

    sql.executeMany(`
        UPDATE note_revisions 
        SET isErased = 1,
            title = NULL
        WHERE isErased = 0 AND noteId IN (???)`, noteIdsToErase);

    sql.executeMany(`
        UPDATE attributes 
        SET name = 'deleted',
            value = ''
        WHERE noteId IN (???)`, noteIdsToErase);

    log.info(`Erased notes: ${JSON.stringify(noteIdsToErase)}`);
}

function duplicateNote(noteId, parentNoteId) {
    const origNote = repository.getNote(noteId);

    if (origNote.isProtected && !protectedSessionService.isProtectedSessionAvailable()) {
        throw new Error(`Cannot duplicate note=${origNote.noteId} because it is protected and protected session is not available`);
    }

    // might be null if orig note is not in the target parentNoteId
    const origBranch = origNote.getBranches().find(branch => branch.parentNoteId === parentNoteId);

    const newNote = new Note(origNote);
    newNote.noteId = undefined; // force creation of new note
    newNote.title += " (dup)";
    newNote.save();

    newNote.setContent(origNote.getContent());

    const newBranch = new Branch({
        noteId: newNote.noteId,
        parentNoteId: parentNoteId,
        // here increasing just by 1 to make sure it's directly after original
        notePosition: origBranch ? origBranch.notePosition + 1 : null
    }).save();

    for (const attribute of origNote.getOwnedAttributes()) {
        const attr = new Attribute(attribute);
        attr.attributeId = undefined; // force creation of new attribute
        attr.noteId = newNote.noteId;

        attr.save();
    }

    return {
        note: newNote,
        branch: newBranch
    };
}

sqlInit.dbReady.then(() => {
    // first cleanup kickoff 5 minutes after startup
    setTimeout(cls.wrap(eraseDeletedNotes), 5 * 60 * 1000);

    setInterval(cls.wrap(eraseDeletedNotes), 4 * 3600 * 1000);
});

module.exports = {
    createNewNote,
    createNewNoteWithTarget,
    updateNote,
    deleteBranch,
    undeleteNote,
    protectNoteRecursively,
    scanForLinks,
    duplicateNote,
    getUndeletedParentBranches,
    triggerNoteTitleChanged
};
