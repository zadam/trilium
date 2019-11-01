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

async function getNewNotePosition(parentNoteId, noteData) {
    let newNotePos = 0;

    if (noteData.target === 'into') {
        const maxNotePos = await sql.getValue('SELECT MAX(notePosition) FROM branches WHERE parentNoteId = ? AND isDeleted = 0', [parentNoteId]);

        newNotePos = maxNotePos === null ? 0 : maxNotePos + 10;
    }
    else if (noteData.target === 'after') {
        const afterNote = await sql.getRow('SELECT notePosition FROM branches WHERE branchId = ?', [noteData.target_branchId]);

        newNotePos = afterNote.notePosition + 10;

        // not updating utcDateModified to avoig having to sync whole rows
        await sql.execute('UPDATE branches SET notePosition = notePosition + 10 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0',
            [parentNoteId, afterNote.notePosition]);

        await syncTableService.addNoteReorderingSync(parentNoteId);
    }
    else {
        throw new Error('Unknown target: ' + noteData.target);
    }
    return newNotePos;
}

async function triggerChildNoteCreated(childNote, parentNote) {
    await eventService.emit(eventService.CHILD_NOTE_CREATED, { childNote, parentNote });
}

async function triggerNoteTitleChanged(note) {
    await eventService.emit(eventService.NOTE_TITLE_CHANGED, note);
}

/**
 * FIXME: noteData has mandatory property "target", it might be better to add it as parameter to reflect this
 */
async function createNewNote(parentNoteId, noteData) {
    let newNotePos;

    if (noteData.notePosition !== undefined) {
        newNotePos = noteData.notePosition;
    }
    else {
        newNotePos = await getNewNotePosition(parentNoteId, noteData);
    }

    const parentNote = await repository.getNote(parentNoteId);

    if (!parentNote) {
        throw new Error(`Parent note ${parentNoteId} not found.`);
    }

    if (!noteData.type) {
        if (parentNote.type === 'text' || parentNote.type === 'code') {
            noteData.type = parentNote.type;
            noteData.mime = parentNote.mime;
        }
        else {
            // inheriting note type makes sense only for text and code
            noteData.type = 'text';
            noteData.mime = 'text/html';
        }
    }

    if (!noteData.mime) {
        if (noteData.type === 'text') {
            noteData.mime = 'text/html';
        }
        else if (noteData.type === 'code') {
            noteData.mime = 'text/plain';
        }
        else if (noteData.type === 'relation-map' || noteData.type === 'search') {
            noteData.mime = 'application/json';
        }
    }

    noteData.type = noteData.type || parentNote.type;
    noteData.mime = noteData.mime || parentNote.mime;

    const note = await new Note({
        noteId: noteData.noteId, // optionally can force specific noteId
        title: noteData.title,
        isProtected: noteData.isProtected,
        type: noteData.type || 'text',
        mime: noteData.mime || 'text/html'
    }).save();

    if (note.isStringNote() || this.type === 'render') { // render to just make sure it's not null
        noteData.content = noteData.content || "";
    }

    await note.setContent(noteData.content);

    const branch = await new Branch({
        noteId: note.noteId,
        parentNoteId: parentNoteId,
        notePosition: newNotePos,
        prefix: noteData.prefix,
        isExpanded: !!noteData.isExpanded
    }).save();

    for (const attr of await parentNote.getAttributes()) {
        if (attr.name.startsWith("child:")) {
            await new Attribute({
               noteId: note.noteId,
               type: attr.type,
               name: attr.name.substr(6),
               value: attr.value,
               position: attr.position,
               isInheritable: attr.isInheritable
            }).save();

            note.invalidateAttributeCache();
        }
    }

    await triggerNoteTitleChanged(note);
    await triggerChildNoteCreated(note, parentNote);

    return {
        note,
        branch
    };
}

async function createNote(parentNoteId, title, content = "", extraOptions = {}) {
    if (!parentNoteId) throw new Error("Empty parentNoteId");
    if (!title) throw new Error("Empty title");

    const noteData = {
        title: title,
        content: extraOptions.json ? JSON.stringify(content, null, '\t') : content,
        target: 'into',
        noteId: extraOptions.noteId,
        isProtected: !!extraOptions.isProtected,
        type: extraOptions.type,
        mime: extraOptions.mime,
        dateCreated: extraOptions.dateCreated,
        isExpanded: extraOptions.isExpanded,
        notePosition: extraOptions.notePosition
    };

    if (extraOptions.json && !noteData.type) {
        noteData.type = "code";
        noteData.mime = "application/json";
    }

    const {note, branch} = await createNewNote(parentNoteId, noteData);

    for (const attr of extraOptions.attributes || []) {
        await attributeService.createAttribute({
            noteId: note.noteId,
            type: attr.type,
            name: attr.name,
            value: attr.value,
            isInheritable: !!attr.isInheritable
        });
    }

    return {note, branch};
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

    await protectNoteRevisions(note);
}

async function protectNoteRevisions(note) {
    for (const revision of await note.getRevisions()) {
        if (note.isProtected !== revision.isProtected) {
            revision.isProtected = note.isProtected;

            await revision.save();
        }
    }
}

function findImageLinks(content, foundLinks) {
    const re = /src="[^"]*api\/images\/([a-zA-Z0-9]+)\//g;
    let match;

    while (match = re.exec(content)) {
        foundLinks.push({
            name: 'image-link',
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
            name: 'internal-link',
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
            name: 'relation-map-link',
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

    if (!['file', 'image', 'render'].includes(note.type)) {
        noteUpdates.content = await saveLinks(note, noteUpdates.content);

        await note.setContent(noteUpdates.content);
    }
    else if (noteUpdates.content) {
        await note.setContent(noteUpdates.content);
    }

    if (noteTitleChanged) {
        await triggerNoteTitleChanged(note);
    }

    await protectNoteRevisions(note);

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

    const utcNowDateTime = dateUtils.utcNowDateTime();
    const localNowDateTime = dateUtils.localNowDateTime();

    // it's better to not use repository for this because it will complain about saving protected notes
    // out of protected session

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

    await sql.executeMany(`
        UPDATE note_revisions 
        SET content = NULL,
            utcDateModified = '${utcNowDateTime}'
        WHERE noteId IN (???)`, noteIdsToErase);
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
    createNote,
    updateNote,
    deleteBranch,
    protectNoteRecursively,
    scanForLinks,
    duplicateNote
};