const sql = require('./sql');
const optionService = require('./options');
const dateUtils = require('./date_utils');
const syncTableService = require('./sync_table');
const attributeService = require('./attributes');
const eventService = require('./events');
const repository = require('./repository');
const Note = require('../entities/note');
const NoteImage = require('../entities/note_image');
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

async function createNewNote(parentNoteId, noteData) {
    const newNotePos = await getNewNotePosition(parentNoteId, noteData);

    const parentNote = await repository.getNote(parentNoteId);

    noteData.type = noteData.type || parentNote.type;
    noteData.mime = noteData.mime || parentNote.mime;

    const note = await new Note({
        title: noteData.title,
        content: noteData.content || '',
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
        mime: extraOptions.mime
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

    await triggerNoteTitleChanged(note);

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

async function saveNoteImages(note) {
    if (note.type !== 'text') {
        return;
    }

    const existingNoteImages = await note.getNoteImages();
    const foundImageIds = [];
    const re = /src="\/api\/images\/([a-zA-Z0-9]+)\//g;
    let match;

    while (match = re.exec(note.content)) {
        const imageId = match[1];
        const existingNoteImage = existingNoteImages.find(ni => ni.imageId === imageId);

        if (!existingNoteImage) {
            await new NoteImage({
                noteId: note.noteId,
                imageId: imageId
            }).save();
        }
        // else we don't need to do anything

        foundImageIds.push(imageId);
    }

    // marking note images as deleted if they are not present on the page anymore
    const unusedNoteImages = existingNoteImages.filter(ni => !foundImageIds.includes(ni.imageId));

    for (const unusedNoteImage of unusedNoteImages) {
        unusedNoteImage.isDeleted = true;

        await unusedNoteImage.save();
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

    await saveNoteImages(note);

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
        note.content = '';
        await note.save();

        for (const noteRevision of await note.getRevisions()) {
            noteRevision.content = '';
            await noteRevision.save();
        }

        for (const childBranch of await note.getChildBranches()) {
            await deleteNote(childBranch);
        }

        for (const attribute of await note.getOwnedAttributes()) {
            attribute.isDeleted = true;
            await attribute.save();
        }

        const targetAttributes = await repository.getEntities("SELECT * FROM attributes WHERE type = 'relation' AND isDeleted = 0 AND value = ?", [note.noteId]);

        for (const attribute of targetAttributes) {
            attribute.isDeleted = true;
            await attribute.save();
        }
    }
}

module.exports = {
    createNewNote,
    createNote,
    updateNote,
    deleteNote,
    protectNoteRecursively
};