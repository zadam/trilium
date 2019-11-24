const sql = require('./sql');
const sqlInit = require('./sql_init');
const optionService = require('./options');
const dateUtils = require('./date_utils');
const syncTableService = require('./sync_table');
const attributeService = require('./attributes');
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
const noteRevisionService = require('../services/note_revisions');

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
    }

    return mime;
}

async function copyChildAttributes(parentNote, childNote) {
    for (const attr of await parentNote.getAttributes()) {
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
 * - {string} type - text, code, file, image, search, book, relation-map
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
        throw new Error(`Parent note ${params.parentNoteId} not found.`);
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
        const afterNote = await sql.getRow('SELECT notePosition FROM branches WHERE branchId = ?', [noteData.target_branchId]);

        // not updating utcDateModified to avoig having to sync whole rows
        await sql.execute('UPDATE branches SET notePosition = notePosition + 10 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0',
            [params.parentNoteId, afterNote.notePosition]);

        params.notePosition = afterNote.notePosition + 10;

        await createNewNote(params);

        await syncTableService.addNoteReorderingSync(params.parentNoteId);
    }
    else {
        throw new Error(`Unknown target ${target}`);
    }
}

// methods below should be probably just backend API methods
async function createJsonNote(parentNoteId, title, content = {}, params = {}) {
    params.parentNoteId = parentNoteId;
    params.title = title;

    params.type = "code";
    params.mime = "application/json";

    params.content = JSON.stringify(content, null, '\t');

    return await createNewNote(params);
}

async function createTextNote(parentNoteId, title, content = "", params = {}) {
    params.parentNoteId = parentNoteId;
    params.title = title;

    params.type = "text";
    params.mime = "text/html";

    params.content = content;

    return await createNewNote(params);
}

async function protectNoteRecursively(note, protect, taskContext) {
    await protectNote(note, protect);

    taskContext.increaseProgressCount();

    for (const child of await note.getChildNotes()) {
        await protectNoteRecursively(child, protect, taskContext);
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

function findRelationMapLinks(content, foundLinks) {
    const obj = JSON.parse(content);

    for (const note of obj.notes) {
        foundLinks.push({
            name: 'relationMapLink',
            value: note.noteId
        });
    }
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
        content = findImageLinks(content, foundLinks);
        content = findInternalLinks(content, foundLinks);
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
            await new Attribute({
                noteId: note.noteId,
                type: 'relation',
                name: foundLink.name,
                value: foundLink.value,
            }).save();
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
    // files and images are immutable, they can't be updated
    // but we don't even version titles which is probably not correct
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

/** @return {boolean} - true if note has been deleted, false otherwise */
async function deleteBranch(branch, taskContext) {
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
    await branch.save();

    const note = await branch.getNote();
    const notDeletedBranches = await note.getBranches();

    if (notDeletedBranches.length === 0) {
        note.isDeleted = true;
        await note.save();

        for (const childBranch of await note.getChildBranches()) {
            await deleteBranch(childBranch, taskContext);
        }

        for (const attribute of await note.getOwnedAttributes()) {
            attribute.isDeleted = true;
            await attribute.save();
        }

        for (const relation of await note.getTargetRelations()) {
            relation.isDeleted = true;
            await relation.save();
        }

        return true;
    }
    else {
        return false;
    }
}

async function scanForLinks(noteId) {
    const note = await repository.getNote(noteId);
    if (!note || !['text', 'relation-map'].includes(note.type)) {
        return;
    }

    try {
        const content = await note.getContent();
        const newContent = await saveLinks(note, content);

        await note.setContent(newContent);
    }
    catch (e) {
        log.error(`Could not scan for links note ${noteId}: ${e.message}`);
    }
}

async function eraseDeletedNotes() {
    const cutoffDate = new Date(Date.now() - 48 * 3600 * 1000);

    const noteIdsToErase = await sql.getColumn("SELECT noteId FROM notes WHERE isDeleted = 1 AND isErased = 0 AND notes.utcDateModified <= ?", [dateUtils.utcDateStr(cutoffDate)]);

    if (noteIdsToErase.length === 0) {
        return;
    }

    const utcNowDateTime = dateUtils.utcNowDateTime();
    const localNowDateTime = dateUtils.localNowDateTime();

    // it's better to not use repository for this because it will complain about saving protected notes
    // out of protected session

    // setting contentLength to zero would serve no benefit and it leaves potentially useful trail
    await sql.executeMany(`
        UPDATE notes 
        SET isErased = 1,
            utcDateModified = '${utcNowDateTime}',
            dateModified = '${localNowDateTime}'
        WHERE noteId IN (???)`, noteIdsToErase);

    await sql.executeMany(`
        UPDATE note_contents 
        SET content = NULL,
            utcDateModified = '${utcNowDateTime}' 
        WHERE noteId IN (???)`, noteIdsToErase);

    // deleting first contents since the WHERE relies on isErased = 0
    await sql.executeMany(`
        UPDATE note_revision_contents
        SET content = NULL,
            utcDateModified = '${utcNowDateTime}'
        WHERE noteRevisionId IN 
            (SELECT noteRevisionId FROM note_revisions WHERE isErased = 0 AND noteId IN ((???)))`, noteIdsToErase);

    await sql.executeMany(`
        UPDATE note_revisions 
        SET isErased = 1,
            title = NULL,
            utcDateModified = '${utcNowDateTime}'
        WHERE isErased = 0 AND noteId IN (???)`, noteIdsToErase);
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

    for (const attribute of await origNote.getAttributes()) {
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
    protectNoteRecursively,
    scanForLinks,
    duplicateNote
};