const sql = require('./sql');
const sqlInit = require('./sql_init');
const optionService = require('./options');
const dateUtils = require('./date_utils');
const entityChangesService = require('./entity_changes');
const eventService = require('./events');
const cls = require('../services/cls');
const protectedSessionService = require('../services/protected_session');
const log = require('../services/log');
const utils = require('../services/utils');
const noteRevisionService = require('../services/note_revisions');
const attributeService = require('../services/attributes');
const request = require('./request');
const path = require('path');
const url = require('url');
const becca = require('../becca/becca');
const Branch = require('../becca/entities/branch');
const Note = require('../becca/entities/note');
const Attribute = require('../becca/entities/attribute');

function getNewNotePosition(parentNoteId) {
    const note = becca.notes[parentNoteId];

    if (!note) {
        throw new Error(`Can't find note ${parentNoteId}`);
    }

    const maxNotePos = note.getChildBranches()
        .reduce((max, note) => Math.max(max, note.notePosition), 0);

    return maxNotePos + 10;
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
    } else if (type === 'code' || type === 'mermaid') {
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
    const parentNote = becca.notes[params.parentNoteId];

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
            branchId: params.branchId,
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
        const parentNote = becca.notes[params.parentNoteId];

        // code note type can be inherited, otherwise text is default
        params.type = parentNote.type === 'code' ? 'code' : 'text';
        params.mime = parentNote.type === 'code' ? parentNote.mime : 'text/html';
    }

    if (target === 'into') {
        return createNewNote(params);
    }
    else if (target === 'after') {
        const afterBranch = becca.branches[targetBranchId];

        // not updating utcDateModified to avoid having to sync whole rows
        sql.execute('UPDATE branches SET notePosition = notePosition + 10 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0',
            [params.parentNoteId, afterBranch.notePosition]);

        params.notePosition = afterBranch.notePosition + 10;

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
    try {
        if (protect !== note.isProtected) {
            const content = note.getContent();

            note.isProtected = protect;

            // this will force de/encryption
            note.setContent(content);

            note.save();
        }

        noteRevisionService.protectNoteRevisions(note);
    }
    catch (e) {
        log.error("Could not un/protect note ID = " + note.noteId);

        throw e;
    }
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
        const {note} = imageService.saveImage(noteId, imageBuffer, title, true, true);

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
            const {note} = imageService.saveImage(noteId, imageBuffer, "inline image", true, true);

            content = content.substr(0, imageMatch.index)
                + `<img src="api/images/${note.noteId}/${note.title}"`
                + content.substr(imageMatch.index + imageMatch[0].length);
        }
        else if (!url.includes('api/images/')
            // this is an exception for the web clipper's "imageId"
            && (url.length !== 20 || url.toLowerCase().startsWith('http'))) {

            if (url in imageUrlToNoteIdMapping) {
                const imageNote = becca.getNote(imageUrlToNoteIdMapping[url]);

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
                const imageNotes = becca.getNotes(Object.values(imageUrlToNoteIdMapping), true);

                const origNote = becca.getNote(noteId);

                if (!origNote) {
                    log.error(`Cannot find note ${noteId} to replace image link.`);
                    return;
                }

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

    const existingLinks = note.getRelations().filter(rel =>
        ['internalLink', 'imageLink', 'relationMapLink', 'includeNoteLink'].includes(rel.name));

    for (const foundLink of foundLinks) {
        const targetNote = becca.notes[foundLink.value];
        if (!targetNote) {
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
        // else the link exists so we don't need to do anything
    }

    // marking links as deleted if they are not present on the page anymore
    const unusedLinks = existingLinks.filter(existingLink => !foundLinks.some(foundLink =>
                                    existingLink.value === foundLink.value
                                    && existingLink.name === foundLink.name));

    for (const unusedLink of unusedLinks) {
        unusedLink.markAsDeleted();
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

    const revisionCutoff = dateUtils.utcDateTimeStr(new Date(now.getTime() - noteRevisionSnapshotTimeInterval * 1000));

    const existingNoteRevisionId = sql.getValue(
        "SELECT noteRevisionId FROM note_revisions WHERE noteId = ? AND utcDateCreated >= ?", [note.noteId, revisionCutoff]);

    const msSinceDateCreated = now.getTime() - dateUtils.parseDateTime(note.utcDateCreated).getTime();

    if (!existingNoteRevisionId && msSinceDateCreated >= noteRevisionSnapshotTimeInterval * 1000) {
        noteRevisionService.createNoteRevision(note);
    }
}

function updateNote(noteId, noteUpdates) {
    const note = becca.getNote(noteId);

    if (!note.isContentAvailable()) {
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

    if (!branch) {
        return false;
    }

    if (branch.branchId === 'root'
        || branch.noteId === 'root'
        || branch.noteId === cls.getHoistedNoteId()) {

        throw new Error("Can't delete root or hoisted branch/note");
    }

    branch.markAsDeleted(deleteId);

    const note = branch.getNote();
    const notDeletedBranches = note.getParentBranches();

    if (notDeletedBranches.length === 0) {
        for (const childBranch of note.getChildBranches()) {
            deleteBranch(childBranch, deleteId, taskContext);
        }

        // first delete children and then parent - this will show up better in recent changes

        log.info("Deleting note " + note.noteId);

        for (const attribute of note.getOwnedAttributes()) {
            attribute.markAsDeleted(deleteId);
        }

        for (const relation of note.getTargetRelations()) {
            relation.markAsDeleted(deleteId);
        }

        note.markAsDeleted(deleteId);

        return true;
    }
    else {
        return false;
    }
}

/**
 * @param {string} noteId
 * @param {TaskContext} taskContext
 */
function undeleteNote(noteId, taskContext) {
    const note = sql.getRow("SELECT * FROM notes WHERE noteId = ?", [noteId]);

    if (!note.isDeleted) {
        log.error(`Note ${noteId} is not deleted and thus cannot be undeleted.`);
        return;
    }

    const undeletedParentBranchIds = getUndeletedParentBranchIds(noteId, note.deleteId);

    if (undeletedParentBranchIds.length === 0) {
        // cannot undelete if there's no undeleted parent
        return;
    }

    for (const parentBranchId of undeletedParentBranchIds) {
        undeleteBranch(parentBranchId, note.deleteId, taskContext);
    }
}

/**
 * @param {string} branchId
 * @param {string} deleteId
 * @param {TaskContext} taskContext
 */
function undeleteBranch(branchId, deleteId, taskContext) {
    const branch = sql.getRow("SELECT * FROM branches WHERE branchId = ?", [branchId])

    if (!branch.isDeleted) {
        return;
    }

    const note = sql.getRow("SELECT * FROM notes WHERE noteId = ?", [branch.noteId]);

    if (note.isDeleted && note.deleteId !== deleteId) {
        return;
    }

    new Branch(branch).save();

    taskContext.increaseProgressCount();

    if (note.isDeleted && note.deleteId === deleteId) {
        new Note(note).save();

        const attributes = sql.getRows(`
                SELECT * FROM attributes 
                WHERE isDeleted = 1 
                  AND deleteId = ? 
                  AND (noteId = ? 
                           OR (type = 'relation' AND value = ?))`, [deleteId, note.noteId, note.noteId]);

        for (const attribute of attributes) {
            new Attribute(attribute).save();
        }

        const childBranchIds = sql.getColumn(`
            SELECT branches.branchId
            FROM branches
            WHERE branches.isDeleted = 1
              AND branches.deleteId = ?
              AND branches.parentNoteId = ?`, [deleteId, note.noteId]);

        for (const childBranchId of childBranchIds) {
            undeleteBranch(childBranchId, deleteId, taskContext);
        }
    }
}

/**
 * @return return deleted branchIds of an undeleted parent note
 */
function getUndeletedParentBranchIds(noteId, deleteId) {
    return sql.getColumn(`
                    SELECT branches.branchId
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

function eraseNotes(noteIdsToErase) {
    if (noteIdsToErase.length === 0) {
        return;
    }

    sql.executeMany(`DELETE FROM notes WHERE noteId IN (???)`, noteIdsToErase);
    setEntityChangesAsErased(sql.getManyRows(`SELECT * FROM entity_changes WHERE entityName = 'notes' AND entityId IN (???)`, noteIdsToErase));

    sql.executeMany(`DELETE FROM note_contents WHERE noteId IN (???)`, noteIdsToErase);
    setEntityChangesAsErased(sql.getManyRows(`SELECT * FROM entity_changes WHERE entityName = 'note_contents' AND entityId IN (???)`, noteIdsToErase));

    // we also need to erase all "dependent" entities of the erased notes
    const branchIdsToErase = sql.getManyRows(`SELECT branchId FROM branches WHERE noteId IN (???)`, noteIdsToErase)
        .map(row => row.branchId);

    eraseBranches(branchIdsToErase);

    const attributeIdsToErase = sql.getManyRows(`SELECT attributeId FROM attributes WHERE noteId IN (???)`, noteIdsToErase)
        .map(row => row.attributeId);

    eraseAttributes(attributeIdsToErase);

    const noteRevisionIdsToErase = sql.getManyRows(`SELECT noteRevisionId FROM note_revisions WHERE noteId IN (???)`, noteIdsToErase)
        .map(row => row.noteRevisionId);

    noteRevisionService.eraseNoteRevisions(noteRevisionIdsToErase);

    log.info(`Erased notes: ${JSON.stringify(noteIdsToErase)}`);
}

function setEntityChangesAsErased(entityChanges) {
    for (const ec of entityChanges) {
        ec.isErased = true;

        entityChangesService.addEntityChange(ec);
    }
}

function eraseBranches(branchIdsToErase) {
    if (branchIdsToErase.length === 0) {
        return;
    }

    sql.executeMany(`DELETE FROM branches WHERE branchId IN (???)`, branchIdsToErase);

    setEntityChangesAsErased(sql.getManyRows(`SELECT * FROM entity_changes WHERE entityName = 'branches' AND entityId IN (???)`, branchIdsToErase));
}

function eraseAttributes(attributeIdsToErase) {
    if (attributeIdsToErase.length === 0) {
        return;
    }

    sql.executeMany(`DELETE FROM attributes WHERE attributeId IN (???)`, attributeIdsToErase);

    setEntityChangesAsErased(sql.getManyRows(`SELECT * FROM entity_changes WHERE entityName = 'attributes' AND entityId IN (???)`, attributeIdsToErase));
}

function eraseDeletedEntities(eraseEntitiesAfterTimeInSeconds = null) {
    // this is important also so that the erased entity changes are sent to the connected clients
    sql.transactional(() => {
        if (eraseEntitiesAfterTimeInSeconds === null) {
            eraseEntitiesAfterTimeInSeconds = optionService.getOptionInt('eraseEntitiesAfterTimeInSeconds');
        }

        const cutoffDate = new Date(Date.now() - eraseEntitiesAfterTimeInSeconds * 1000);

        const noteIdsToErase = sql.getColumn("SELECT noteId FROM notes WHERE isDeleted = 1 AND utcDateModified <= ?", [dateUtils.utcDateTimeStr(cutoffDate)]);

        eraseNotes(noteIdsToErase);

        const branchIdsToErase = sql.getColumn("SELECT branchId FROM branches WHERE isDeleted = 1 AND utcDateModified <= ?", [dateUtils.utcDateTimeStr(cutoffDate)]);

        eraseBranches(branchIdsToErase);

        const attributeIdsToErase = sql.getColumn("SELECT attributeId FROM attributes WHERE isDeleted = 1 AND utcDateModified <= ?", [dateUtils.utcDateTimeStr(cutoffDate)]);

        eraseAttributes(attributeIdsToErase);
    });
}

function eraseNotesWithDeleteId(deleteId) {
    const noteIdsToErase = sql.getColumn("SELECT noteId FROM notes WHERE deleteId = ?", [deleteId]);

    eraseNotes(noteIdsToErase);

    const branchIdsToErase = sql.getColumn("SELECT branchId FROM branches WHERE deleteId = ?", [deleteId]);

    eraseBranches(branchIdsToErase);

    const attributeIdsToErase = sql.getColumn("SELECT attributeId FROM attributes WHERE  deleteId = ?", [deleteId]);

    eraseAttributes(attributeIdsToErase);
}

function eraseDeletedNotesNow() {
    eraseDeletedEntities(0);
}

// do a replace in str - all keys should be replaced by the corresponding values
function replaceByMap(str, mapObj) {
    const re = new RegExp(Object.keys(mapObj).join("|"),"g");

    return str.replace(re, matched => mapObj[matched]);
}

function duplicateSubtree(origNoteId, newParentNoteId) {
    if (origNoteId === 'root') {
        throw new Error('Duplicating root is not possible');
    }

    log.info(`Duplicating ${origNoteId} subtree into ${newParentNoteId}`);

    const origNote = becca.notes[origNoteId];
    // might be null if orig note is not in the target newParentNoteId
    const origBranch = origNote.getParentBranches().find(branch => branch.parentNoteId === newParentNoteId);

    const noteIdMapping = getNoteIdMapping(origNote);

    const res = duplicateSubtreeInner(origNote, origBranch, newParentNoteId, noteIdMapping);

    if (!res.note.title.endsWith('(dup)')) {
        res.note.title += " (dup)";
    }

    res.note.save();

    return res;
}

function duplicateSubtreeWithoutRoot(origNoteId, newNoteId) {
    if (origNoteId === 'root') {
        throw new Error('Duplicating root is not possible');
    }

    const origNote = becca.getNote(origNoteId);
    const noteIdMapping = getNoteIdMapping(origNote);

    for (const childBranch of origNote.getChildBranches()) {
        duplicateSubtreeInner(childBranch.getNote(), childBranch, newNoteId, noteIdMapping);
    }
}

function duplicateSubtreeInner(origNote, origBranch, newParentNoteId, noteIdMapping) {
    if (origNote.isProtected && !protectedSessionService.isProtectedSessionAvailable()) {
        throw new Error(`Cannot duplicate note=${origNote.noteId} because it is protected and protected session is not available. Enter protected session and try again.`);
    }

    const newNoteId = noteIdMapping[origNote.noteId];

    function createDuplicatedBranch() {
        return new Branch({
            noteId: newNoteId,
            parentNoteId: newParentNoteId,
            // here increasing just by 1 to make sure it's directly after original
            notePosition: origBranch ? origBranch.notePosition + 1 : null
        }).save();
    }

    function createDuplicatedNote() {
        const newNote = new Note({
            ...origNote,
            noteId: newNoteId,
            dateCreated: dateUtils.localNowDateTime(),
            utcDateCreated: dateUtils.utcNowDateTime()
        }).save();

        let content = origNote.getContent();

        if (['text', 'relation-map', 'search'].includes(origNote.type)) {
            // fix links in the content
            content = replaceByMap(content, noteIdMapping);
        }

        newNote.setContent(content);

        for (const attribute of origNote.getOwnedAttributes()) {
            const attr = new Attribute({
                ...attribute,
                attributeId: undefined,
                noteId: newNote.noteId
            });

            // if relation points to within the duplicated tree then replace the target to the duplicated note
            // if it points outside of duplicated tree then keep the original target
            if (attr.type === 'relation' && attr.value in noteIdMapping) {
                attr.value = noteIdMapping[attr.value];
            }

            attr.save();
        }

        for (const childBranch of origNote.getChildBranches()) {
            duplicateSubtreeInner(childBranch.getNote(), childBranch, newNote.noteId, noteIdMapping);
        }
        return newNote;
    }

    const existingNote = becca.notes[newNoteId];

    if (existingNote && existingNote.title !== undefined) { // checking that it's not just note's skeleton created because of Branch above
        // note has multiple clones and was already created from another placement in the tree
        // so a branch is all we need for this clone
        return {
            note: existingNote,
            branch: createDuplicatedBranch()
        }
    }
    else {
        return {
            // order here is important, note needs to be created first to not mess up the becca
            note: createDuplicatedNote(),
            branch: createDuplicatedBranch()
        }
    }
}

function getNoteIdMapping(origNote) {
    const noteIdMapping = {};

    // pregenerate new noteIds since we'll need to fix relation references even for not yet created notes
    for (const origNoteId of origNote.getDescendantNoteIds()) {
        noteIdMapping[origNoteId] = utils.newEntityId();
    }

    return noteIdMapping;
}

sqlInit.dbReady.then(() => {
    // first cleanup kickoff 5 minutes after startup
    setTimeout(cls.wrap(() => eraseDeletedEntities()), 5 * 60 * 1000);

    setInterval(cls.wrap(() => eraseDeletedEntities()), 4 * 3600 * 1000);
});

module.exports = {
    createNewNote,
    createNewNoteWithTarget,
    updateNote,
    deleteBranch,
    undeleteNote,
    protectNoteRecursively,
    scanForLinks,
    duplicateSubtree,
    duplicateSubtreeWithoutRoot,
    getUndeletedParentBranchIds,
    triggerNoteTitleChanged,
    eraseDeletedNotesNow,
    eraseNotesWithDeleteId,
    saveNoteRevision
};
