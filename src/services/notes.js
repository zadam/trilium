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
    const newNotePos = await getNewNotePosition(parentNoteId, noteData);

    const parentNote = await repository.getNote(parentNoteId);

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

    const note = await new Note({
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
        isExpanded: 0
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
        isProtected: !!extraOptions.isProtected,
        type: extraOptions.type,
        mime: extraOptions.mime,
        dateCreated: extraOptions.dateCreated
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

async function saveLinks(note) {
    if (note.type !== 'text') {
        return;
    }

    const existingLinks = await note.getLinks();
    const foundNoteIds = [];
    const re = /src="\/api\/images\/([a-zA-Z0-9]+)\//g;
    let match;

    while (match = re.exec(note.content)) {
        const targetNoteId = match[1];
        const existingLink = existingLinks.find(link => link.targetNoteId === targetNoteId && link.type === 'image');

        if (!existingLink) {
            await new Link({
                noteId: note.noteId,
                targetNoteId,
                type: 'image'
            }).save();
        }
        else if (existingLink.isDeleted) {
            existingLink.isDeleted = false;
            await existingLink.save();
        }
        // else the link exists so we don't need to do anything

        foundNoteIds.push(targetNoteId);
    }

    // marking links as deleted if they are not present on the page anymore
    const unusedLinks = existingLinks.filter(link => !foundNoteIds.includes(link.noteId));

    for (const unusedLink of unusedLinks) {
        unusedLink.isDeleted = true;
        await unusedLink.save();
    }
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

    if (note.type === 'file') {
        // for update file, newNote doesn't contain file payloads
        noteUpdates.content = note.content;
    }

    await saveNoteRevision(note);

    const noteTitleChanged = note.title !== noteUpdates.title;

    note.title = noteUpdates.title;
    note.setContent(noteUpdates.content);
    note.isProtected = noteUpdates.isProtected;
    await note.save();

    if (noteTitleChanged) {
        await triggerNoteTitleChanged(note);
    }

    await saveLinks(note);

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

        for (const attribute of await note.getTargetRelations()) {
            attribute.isDeleted = true;
            await attribute.save();
        }
    }
}

async function cleanupDeletedNotes() {
    const cutoffDate = new Date(new Date().getTime() - 48 * 3600 * 1000);

    const notesForCleanup = await repository.getEntities("SELECT * FROM notes WHERE isDeleted = 1 AND content != '' AND dateModified <= ?", [dateUtils.dateStr(cutoffDate)]);

    for (const note of notesForCleanup) {
        note.content = '';
        await note.save();
    }

    const notesRevisionsForCleanup = await repository.getEntities("SELECT note_revisions.* FROM notes JOIN note_revisions USING(noteId) WHERE notes.isDeleted = 1 AND note_revisions.content != '' AND notes.dateModified <= ?", [dateUtils.dateStr(cutoffDate)]);

    for (const noteRevision of notesRevisionsForCleanup) {
        noteRevision.content = '';
        await noteRevision.save();
    }
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