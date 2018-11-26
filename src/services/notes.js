const sql = require('./sql');
const optionService = require('./options');
const dateUtils = require('./date_utils');
const syncTableService = require('./sync_table');
const attributeService = require('./attributes');
const eventService = require('./events');
const repository = require('./repository');
const cls = require('../services/cls');
const Note = require('../entities/note');
const Link = require('../entities/link');
const NoteRevision = require('../entities/note_revision');
const Branch = require('../entities/branch');
const Attribute = require('../entities/attribute');

async function getNewNotePosition(parentNoteId, noteData) {
    let newNotePos = 0;

    if (noteData.target === 'into') {
        const maxNotePos = await sql.getValue('SELECT MAX(notePosition) FROM branches WHERE parentNoteId = ? AND isDeleted = 0', [parentNoteId]);

        newNotePos = maxNotePos === null ? 0 : maxNotePos + 1;
    }
    else if (noteData.target === 'after') {
        const afterNote = await sql.getRow('SELECT notePosition FROM branches WHERE branchId = ?', [noteData.target_branchId]);

        newNotePos = afterNote.notePosition + 1;

        // not updating dateModified to avoig having to sync whole rows
        await sql.execute('UPDATE branches SET notePosition = notePosition + 1 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0',
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

    noteData.type = noteData.type || parentNote.type;
    noteData.mime = noteData.mime || parentNote.mime;

    if (noteData.type === 'text' || noteData.type === 'code') {
        noteData.content = noteData.content || "";
    }

    const note = await new Note({
        noteId: noteData.noteId, // optionally can force specific noteId
        title: noteData.title,
        content: noteData.content,
        isProtected: noteData.isProtected,
        type: noteData.type || 'text',
        mime: noteData.mime || 'text/html'
    }).save();

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
            value: attr.value
        });
    }

    return {note, branch};
}

async function protectNoteRecursively(note, protect) {
    await protectNote(note, protect);

    for (const child of await note.getChildNotes()) {
        await protectNoteRecursively(child, protect);
    }
}

async function protectNote(note, protect) {
    if (protect !== note.isProtected) {
        note.isProtected = protect;

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
    const re = /src="[^"]*\/api\/images\/([a-zA-Z0-9]+)\//g;
    let match;

    while (match = re.exec(content)) {
        foundLinks.push({
            type: 'image',
            targetNoteId: match[1]
        });
    }

    // removing absolute references to server to keep it working between instances
    return content.replace(/src="[^"]*\/api\/images\//g, 'src="/api/images/');
}

function findHyperLinks(content, foundLinks) {
    const re = /href="[^"]*#root[a-zA-Z0-9\/]*\/([a-zA-Z0-9]+)\/?"/g;
    let match;

    while (match = re.exec(content)) {
        foundLinks.push({
            type: 'hyper',
            targetNoteId: match[1]
        });
    }

    // removing absolute references to server to keep it working between instances
    return content.replace(/href="[^"]*#root/g, 'href="#root');
}

function findRelationMapLinks(content, foundLinks) {
    const obj = JSON.parse(content);

    for (const note of obj.notes) {
        foundLinks.push({
            type: 'relation-map',
            targetNoteId: note.noteId
        })
    }
}

async function saveLinks(note, content) {
    if (note.type !== 'text' && note.type !== 'relation-map') {
        return content;
    }

    const foundLinks = [];

    if (note.type === 'text') {
        content = findImageLinks(content, foundLinks);
        content = findHyperLinks(content, foundLinks);
    }
    else if (note.type === 'relation-map') {
        findRelationMapLinks(content, foundLinks);
    }
    else {
        throw new Error("Unrecognized type " + note.type);
    }

    const existingLinks = await note.getLinks();

    for (const foundLink of foundLinks) {
        const existingLink = existingLinks.find(existingLink =>
            existingLink.targetNoteId === foundLink.targetNoteId
            && existingLink.type === foundLink.type);

        if (!existingLink) {
            await new Link({
                noteId: note.noteId,
                targetNoteId: foundLink.targetNoteId,
                type: foundLink.type
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
                                    existingLink.targetNoteId === foundLink.targetNoteId
                                    && existingLink.type === foundLink.type));

    for (const unusedLink of unusedLinks) {
        unusedLink.isDeleted = true;
        await unusedLink.save();
    }

    return content;
}

async function saveNoteRevision(note) {
    const now = new Date();
    const noteRevisionSnapshotTimeInterval = parseInt(await optionService.getOption('noteRevisionSnapshotTimeInterval'));

    const revisionCutoff = dateUtils.dateStr(new Date(now.getTime() - noteRevisionSnapshotTimeInterval * 1000));

    const existingNoteRevisionId = await sql.getValue(
        "SELECT noteRevisionId FROM note_revisions WHERE noteId = ? AND dateModifiedTo >= ?", [note.noteId, revisionCutoff]);

    const msSinceDateCreated = now.getTime() - dateUtils.parseDateTime(note.dateCreated).getTime();

    if (note.type !== 'file'
        && !await note.hasLabel('disableVersioning')
        && !existingNoteRevisionId
        && msSinceDateCreated >= noteRevisionSnapshotTimeInterval * 1000) {

        await new NoteRevision({
            noteId: note.noteId,
            // title and text should be decrypted now
            title: note.title,
            content: note.content,
            type: note.type,
            mime: note.mime,
            isProtected: false, // will be fixed in the protectNoteRevisions() call
            dateModifiedFrom: note.dateModified,
            dateModifiedTo: dateUtils.nowDate()
        }).save();
    }
}

async function updateNote(noteId, noteUpdates) {
    const note = await repository.getNote(noteId);

    if (!note.isContentAvailable) {
        throw new Error(`Note ${noteId} is not available for change!`);
    }

    if (note.type === 'file' || note.type === 'image') {
        // files and images are immutable, they can't be updated
        noteUpdates.content = note.content;
    }

    await saveNoteRevision(note);

    const noteTitleChanged = note.title !== noteUpdates.title;

    noteUpdates.content = await saveLinks(note, noteUpdates.content);

    note.title = noteUpdates.title;
    note.setContent(noteUpdates.content);
    note.isProtected = noteUpdates.isProtected;
    await note.save();

    if (noteTitleChanged) {
        await triggerNoteTitleChanged(note);
    }

    await protectNoteRevisions(note);
}

async function deleteNote(branch) {
    if (!branch || branch.isDeleted) {
        return;
    }

    if (branch.branchId === 'root' || branch.noteId === 'root') {
        throw new Error("Can't delete root branch/note");
    }

    branch.isDeleted = true;
    await branch.save();

    const note = await branch.getNote();
    const notDeletedBranches = await note.getBranches();

    if (notDeletedBranches.length === 0) {
        note.isDeleted = true;
        // we don't reset content here, that's postponed and done later to give the user
        // a chance to correct a mistake
        await note.save();

        for (const noteRevision of await note.getRevisions()) {
            await noteRevision.save();
        }

        for (const childBranch of await note.getChildBranches()) {
            await deleteNote(childBranch);
        }

        for (const attribute of await note.getOwnedAttributes()) {
            attribute.isDeleted = true;
            await attribute.save();
        }

        for (const relation of await note.getTargetRelations()) {
            relation.isDeleted = true;
            await relation.save();
        }

        for (const link of await note.getLinks()) {
            link.isDeleted = true;
            await link.save();
        }

        for (const link of await note.getTargetLinks()) {
            link.isDeleted = true;
            await link.save();
        }
    }
}

async function cleanupDeletedNotes() {
    const cutoffDate = new Date(new Date().getTime() - 48 * 3600 * 1000);

    // it's better to not use repository for this because it will complain about saving protected notes
    // out of protected session

    await sql.execute("UPDATE notes SET content = NULL WHERE isDeleted = 1 AND content IS NOT NULL AND dateModified <= ?", [dateUtils.dateStr(cutoffDate)]);

    await sql.execute("UPDATE note_revisions SET content = NULL WHERE note_revisions.content IS NOT NULL AND noteId IN (SELECT noteId FROM notes WHERE isDeleted = 1 AND notes.dateModified <= ?)", [dateUtils.dateStr(cutoffDate)]);
}

// first cleanup kickoff 5 minutes after startup
setTimeout(cls.wrap(cleanupDeletedNotes), 5 * 60 * 1000);

setInterval(cls.wrap(cleanupDeletedNotes), 4 * 3600 * 1000);

module.exports = {
    createNewNote,
    createNote,
    updateNote,
    deleteNote,
    protectNoteRecursively
};