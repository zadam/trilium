const sql = require('./sql');
const sqlInit = require('./sql_init');
const optionService = require('./options');
const dateUtils = require('./date_utils');
const syncTableService = require('./sync_table');
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

async function getNewNotePosition(parentNoteId) {
    const maxNotePos = await sql.getValue(`
            SELECT MAX(notePosition) 
            FROM branches 
            WHERE parentNoteId = ? 
              AND isDeleted = 0`, [parentNoteId]);

    return maxNotePos === null ? 0 : maxNotePos + 10;
}

async function triggerChildNoteCreated(childNote, parentNote) {
    await eventService.emit(eventService.CHILD_NOTE_CREATED, { childNote, parentNote });
}

async function triggerNoteTitleChanged(note) {
    await eventService.emit(eventService.NOTE_TITLE_CHANGED, note);
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
    }

    return mime;
}

async function copyChildAttributes(parentNote, childNote) {
    for (const attr of await parentNote.getOwnedAttributes()) {
        if (attr.name.startsWith("child:")) {
            await new Attribute({
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
 * @return {Promise<{note: Note, branch: Branch}>}
 */
async function createNewNote(params) {
    const parentNote = await repository.getNote(params.parentNoteId);

    if (!parentNote) {
        throw new Error(`Parent note "${params.parentNoteId}" not found.`);
    }

    if (!params.title || params.title.trim().length === 0) {
        throw new Error(`Note title must not be empty`);
    }

    const note = await new Note({
        noteId: params.noteId, // optionally can force specific noteId
        title: params.title,
        isProtected: !!params.isProtected,
        type: params.type,
        mime: deriveMime(params.type, params.mime)
    }).save();

    await note.setContent(params.content);

    const branch = await new Branch({
        noteId: note.noteId,
        parentNoteId: params.parentNoteId,
        notePosition: params.notePosition !== undefined ? params.notePosition : await getNewNotePosition(params.parentNoteId),
        prefix: params.prefix,
        isExpanded: !!params.isExpanded
    }).save();

    await scanForLinks(note);

    await copyChildAttributes(parentNote, note);

    await triggerNoteTitleChanged(note);
    await triggerChildNoteCreated(note, parentNote);

    return {
        note,
        branch
    };
}

async function createNewNoteWithTarget(target, targetBranchId, params) {
    if (!params.type) {
        const parentNote = await repository.getNote(params.parentNoteId);

        // code note type can be inherited, otherwise text is default
        params.type = parentNote.type === 'code' ? 'code' : 'text';
        params.mime = parentNote.type === 'code' ? parentNote.mime : 'text/html';
    }

    if (target === 'into') {
        return await createNewNote(params);
    }
    else if (target === 'after') {
        const afterNote = await sql.getRow('SELECT notePosition FROM branches WHERE branchId = ?', [targetBranchId]);

        // not updating utcDateModified to avoig having to sync whole rows
        await sql.execute('UPDATE branches SET notePosition = notePosition + 10 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0',
            [params.parentNoteId, afterNote.notePosition]);

        params.notePosition = afterNote.notePosition + 10;

        const retObject = await createNewNote(params);

        await syncTableService.addNoteReorderingSync(params.parentNoteId);

        return retObject;
    }
    else {
        throw new Error(`Unknown target ${target}`);
    }
}

async function protectNoteRecursively(note, protect, includingSubTree, taskContext) {
    await protectNote(note, protect);

    taskContext.increaseProgressCount();

    if (includingSubTree) {
        for (const child of await note.getChildNotes()) {
            await protectNoteRecursively(child, protect, includingSubTree, taskContext);
        }
    }
}

async function protectNote(note, protect) {
    if (protect !== note.isProtected) {
        const content = await note.getContent();

        note.isProtected = protect;

        // this will force de/encryption
        await note.setContent(content);

        await note.save();
    }

    await noteRevisionService.protectNoteRevisions(note);
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
        const {note} = await imageService.saveImage(noteId, imageBuffer, title, true);

        await note.addLabel('imageUrl', imageUrl);

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

    return content.replace(new RegExp(`\\s+src=[\"']${quotedUrl}[\"']`, "g"), ` src="api/images/${imageNote.noteId}/${imageNote.title}"`);
}

async function downloadImages(noteId, content) {
    const re = /<img[^>]*?\ssrc=['"]([^'">]+)['"]/ig;
    let match;

    const origContent = content;

    while (match = re.exec(origContent)) {
        const url = match[1];

        if (!url.includes('api/images/')
            // this is and exception for the web clipper's "imageId"
            && (url.length !== 20 || url.toLowerCase().startsWith('http'))) {

            if (url in imageUrlToNoteIdMapping) {
                const imageNote = await repository.getNote(imageUrlToNoteIdMapping[url]);

                if (!imageNote || imageNote.isDeleted) {
                    delete imageUrlToNoteIdMapping[url];
                }
                else {
                    content = replaceUrl(content, url, imageNote);

                    continue;
                }
            }

            const existingImage = (await attributeService.getNotesWithLabel('imageUrl', url))
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
        setTimeout(async () => {
            // the normal expected flow of the offline image saving is that users will paste the image(s)
            // which will get asynchronously downloaded, during that time they keep editing the note
            // once the download is finished, the image note representing downloaded image will be used
            // to replace the IMG link.
            // However there's another flow where user pastes the image and leaves the note before the images
            // are downloaded and the IMG references are not updated. For this occassion we have this code
            // which upon the download of all the images will update the note if the links have not been fixed before

            await sql.transactional(async () => {
                const imageNotes = await repository.getNotes(Object.values(imageUrlToNoteIdMapping));

                const origNote = await repository.getNote(noteId);
                const origContent = await origNote.getContent();
                let updatedContent = origContent;

                for (const url in imageUrlToNoteIdMapping) {
                    const imageNote = imageNotes.find(note => note.noteId === imageUrlToNoteIdMapping[url]);

                    if (imageNote && !imageNote.isDeleted) {
                        updatedContent = replaceUrl(updatedContent, url, imageNote);
                    }
                }

                // update only if the links have not been already fixed.
                if (updatedContent !== origContent) {
                    await origNote.setContent(updatedContent);

                    await scanForLinks(origNote);

                    console.log(`Fixed the image links for note ${noteId} to the offline saved.`);
                }
            });
        }, 5000);
    });

    return content;
}

async function saveLinks(note, content) {
    if (note.type !== 'text' && note.type !== 'relation-map') {
        return content;
    }

    if (note.isProtected && !protectedSessionService.isProtectedSessionAvailable()) {
        return content;
    }

    const foundLinks = [];

    if (note.type === 'text') {
        content = await downloadImages(note.noteId, content);

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

    const existingLinks = await note.getLinks();

    for (const foundLink of foundLinks) {
        const targetNote = await repository.getNote(foundLink.value);
        if (!targetNote || targetNote.isDeleted) {
            continue;
        }

        const existingLink = existingLinks.find(existingLink =>
            existingLink.value === foundLink.value
            && existingLink.name === foundLink.name);

        if (!existingLink) {
            const newLink = await new Attribute({
                noteId: note.noteId,
                type: 'relation',
                name: foundLink.name,
                value: foundLink.value,
            }).save();

            existingLinks.push(newLink);
        }
        else if (existingLink.isDeleted) {
            existingLink.isDeleted = false;
            await existingLink.save();
        }
        // else the link exists so we don't need to do anything
    }

    // marking links as deleted if they are not present on the page anymore
    const unusedLinks = existingLinks.filter(existingLink => !foundLinks.some(foundLink =>
                                    existingLink.value === foundLink.value
                                    && existingLink.name === foundLink.name));

    for (const unusedLink of unusedLinks) {
        unusedLink.isDeleted = true;
        await unusedLink.save();
    }

    return content;
}

async function saveNoteRevision(note) {
    // files and images are versioned separately
    if (note.type === 'file' || note.type === 'image' || await note.hasLabel('disableVersioning')) {
        return;
    }

    const now = new Date();
    const noteRevisionSnapshotTimeInterval = parseInt(await optionService.getOption('noteRevisionSnapshotTimeInterval'));

    const revisionCutoff = dateUtils.utcDateStr(new Date(now.getTime() - noteRevisionSnapshotTimeInterval * 1000));

    const existingNoteRevisionId = await sql.getValue(
        "SELECT noteRevisionId FROM note_revisions WHERE noteId = ? AND utcDateCreated >= ?", [note.noteId, revisionCutoff]);

    const msSinceDateCreated = now.getTime() - dateUtils.parseDateTime(note.utcDateCreated).getTime();

    if (!existingNoteRevisionId && msSinceDateCreated >= noteRevisionSnapshotTimeInterval * 1000) {
        const noteRevision = await new NoteRevision({
            noteId: note.noteId,
            // title and text should be decrypted now
            title: note.title,
            contentLength: -1, // will be updated in .setContent()
            type: note.type,
            mime: note.mime,
            isProtected: false, // will be fixed in the protectNoteRevisions() call
            utcDateLastEdited: note.utcDateModified,
            utcDateCreated: dateUtils.utcNowDateTime(),
            utcDateModified: dateUtils.utcNowDateTime(),
            dateLastEdited: note.dateModified,
            dateCreated: dateUtils.localNowDateTime()
        }).save();

        await noteRevision.setContent(await note.getContent());
    }
}

async function updateNote(noteId, noteUpdates) {
    const note = await repository.getNote(noteId);

    if (!note.isContentAvailable) {
        throw new Error(`Note ${noteId} is not available for change!`);
    }

    await saveNoteRevision(note);

    // if protected status changed, then we need to encrypt/decrypt the content anyway
    if (['file', 'image'].includes(note.type) && note.isProtected !== noteUpdates.isProtected) {
        noteUpdates.content = await note.getContent();
    }

    const noteTitleChanged = note.title !== noteUpdates.title;

    note.title = noteUpdates.title;
    note.isProtected = noteUpdates.isProtected;
    await note.save();

    if (noteUpdates.content !== undefined && noteUpdates.content !== null) {
        noteUpdates.content = await saveLinks(note, noteUpdates.content);

        await note.setContent(noteUpdates.content);
    }

    if (noteTitleChanged) {
        await triggerNoteTitleChanged(note);
    }

    await noteRevisionService.protectNoteRevisions(note);

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
async function deleteBranch(branch, deleteId, taskContext) {
    taskContext.increaseProgressCount();

    if (!branch || branch.isDeleted) {
        return false;
    }

    if (branch.branchId === 'root'
        || branch.noteId === 'root'
        || branch.noteId === await hoistedNoteService.getHoistedNoteId()) {

        throw new Error("Can't delete root branch/note");
    }

    branch.isDeleted = true;
    branch.deleteId = deleteId;
    await branch.save();

    const note = await branch.getNote();
    const notDeletedBranches = await note.getBranches();

    if (notDeletedBranches.length === 0) {
        for (const childBranch of await note.getChildBranches()) {
            await deleteBranch(childBranch, deleteId, taskContext);
        }

        // first delete children and then parent - this will show up better in recent changes

        note.isDeleted = true;
        note.deleteId = deleteId;
        await note.save();

        log.info("Deleting note " + note.noteId);

        for (const attribute of await note.getOwnedAttributes()) {
            attribute.isDeleted = true;
            attribute.deleteId = deleteId;
            await attribute.save();
        }

        for (const relation of await note.getTargetRelations()) {
            relation.isDeleted = true;
            relation.deleteId = deleteId;
            await relation.save();
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
async function undeleteNote(note, deleteId, taskContext) {
    const undeletedParentBranches = await getUndeletedParentBranches(note.noteId, deleteId);

    if (undeletedParentBranches.length === 0) {
        // cannot undelete if there's no undeleted parent
        return;
    }

    for (const parentBranch of undeletedParentBranches) {
        await undeleteBranch(parentBranch, deleteId, taskContext);
    }
}

/**
 * @param {Branch} branch
 * @param {string} deleteId
 * @param {TaskContext} taskContext
 */
async function undeleteBranch(branch, deleteId, taskContext) {
    if (!branch.isDeleted) {
        return;
    }

    const note = await branch.getNote();

    if (note.isDeleted && note.deleteId !== deleteId) {
        return;
    }

    branch.isDeleted = false;
    await branch.save();

    taskContext.increaseProgressCount();

    if (note.isDeleted && note.deleteId === deleteId) {
        note.isDeleted = false;
        await note.save();

        const attrs = await repository.getEntities(`
                SELECT * FROM attributes 
                WHERE isDeleted = 1 
                  AND deleteId = ? 
                  AND (noteId = ? 
                           OR (type = 'relation' AND value = ?))`, [deleteId, note.noteId, note.noteId]);

        for (const attr of attrs) {
            attr.isDeleted = false;
            await attr.save();
        }

        const childBranches = await repository.getEntities(`
            SELECT branches.*
            FROM branches
            WHERE branches.isDeleted = 1
              AND branches.deleteId = ?
              AND branches.parentNoteId = ?`, [deleteId, note.noteId]);

        for (const childBranch of childBranches) {
            await undeleteBranch(childBranch, deleteId, taskContext);
        }
    }
}

/**
 * @return return deleted branches of an undeleted parent note
 */
async function getUndeletedParentBranches(noteId, deleteId) {
    return await repository.getEntities(`
                    SELECT branches.*
                    FROM branches
                    JOIN notes AS parentNote ON parentNote.noteId = branches.parentNoteId
                    WHERE branches.noteId = ?
                      AND branches.isDeleted = 1
                      AND branches.deleteId = ?
                      AND parentNote.isDeleted = 0`, [noteId, deleteId]);
}

async function scanForLinks(note) {
    if (!note || !['text', 'relation-map'].includes(note.type)) {
        return;
    }

    try {
        const content = await note.getContent();
        const newContent = await saveLinks(note, content);

        if (content !== newContent) {
            await note.setContent(newContent);
        }
    }
    catch (e) {
        log.error(`Could not scan for links note ${note.noteId}: ${e.message} ${e.stack}`);
    }
}

async function eraseDeletedNotes() {
    const eraseNotesAfterTimeInSeconds = await optionService.getOptionInt('eraseNotesAfterTimeInSeconds');

    const cutoffDate = new Date(Date.now() - eraseNotesAfterTimeInSeconds * 1000);

    const noteIdsToErase = await sql.getColumn("SELECT noteId FROM notes WHERE isDeleted = 1 AND isErased = 0 AND notes.utcDateModified <= ?", [dateUtils.utcDateStr(cutoffDate)]);

    if (noteIdsToErase.length === 0) {
        return;
    }

    // it's better to not use repository for this because:
    // - it would complain about saving protected notes out of protected session
    // - we don't want these changes to be synced (since they are done on all instances anyway)
    // - we don't want change the hash since this erasing happens on each instance separately
    //   and changing the hash would fire up the sync errors temporarily

    await sql.executeMany(`
        UPDATE notes 
        SET title = '[deleted]',
            contentLength = 0,
            isProtected = 0,
            isErased = 1
        WHERE noteId IN (???)`, noteIdsToErase);

    await sql.executeMany(`
        UPDATE note_contents 
        SET content = NULL 
        WHERE noteId IN (???)`, noteIdsToErase);

    // deleting first contents since the WHERE relies on isErased = 0
    await sql.executeMany(`
        UPDATE note_revision_contents
        SET content = NULL
        WHERE noteRevisionId IN 
            (SELECT noteRevisionId FROM note_revisions WHERE isErased = 0 AND noteId IN (???))`, noteIdsToErase);

    await sql.executeMany(`
        UPDATE note_revisions 
        SET isErased = 1,
            title = NULL,
            contentLength = 0
        WHERE isErased = 0 AND noteId IN (???)`, noteIdsToErase);

    await sql.executeMany(`
        UPDATE attributes 
        SET name = 'deleted',
            value = ''
        WHERE noteId IN (???)`, noteIdsToErase);

    log.info(`Erased notes: ${JSON.stringify(noteIdsToErase)}`);
}

async function duplicateNote(noteId, parentNoteId) {
    const origNote = await repository.getNote(noteId);

    if (origNote.isProtected && !protectedSessionService.isProtectedSessionAvailable()) {
        throw new Error(`Cannot duplicate note=${origNote.noteId} because it is protected and protected session is not available`);
    }

    // might be null if orig note is not in the target parentNoteId
    const origBranch = (await origNote.getBranches()).find(branch => branch.parentNoteId === parentNoteId);

    const newNote = new Note(origNote);
    newNote.noteId = undefined; // force creation of new note
    newNote.title += " (dup)";

    await newNote.save();
    await newNote.setContent(await origNote.getContent());

    const newBranch = await new Branch({
        noteId: newNote.noteId,
        parentNoteId: parentNoteId,
        // here increasing just by 1 to make sure it's directly after original
        notePosition: origBranch ? origBranch.notePosition + 1 : null
    }).save();

    for (const attribute of await origNote.getOwnedAttributes()) {
        const attr = new Attribute(attribute);
        attr.attributeId = undefined; // force creation of new attribute
        attr.noteId = newNote.noteId;

        await attr.save();
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
