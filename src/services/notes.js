const sql = require('./sql');
const optionService = require('./options');
const dateUtils = require('./date_utils');
const syncTableService = require('./sync_table');
const labelService = require('./labels');
const repository = require('./repository');
const Note = require('../entities/note');
const NoteImage = require('../entities/note_image');
const NoteRevision = require('../entities/note_revision');
const Branch = require('../entities/branch');

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

async function createNewNote(parentNoteId, noteData) {
    const newNotePos = await getNewNotePosition(parentNoteId, noteData);

    if (parentNoteId !== 'root') {
        const parent = await repository.getNote(parentNoteId);

        noteData.type = noteData.type || parent.type;
        noteData.mime = noteData.mime || parent.mime;
    }

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
        isExpanded: 0
    }).save();

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

    if (extraOptions.labels) {
        for (const labelName in extraOptions.labels) {
            await labelService.createLabel(note.noteId, labelName, extraOptions.labels[labelName]);
        }
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
    const labelsMap = await note.getLabelMap();

    const now = new Date();
    const noteRevisionSnapshotTimeInterval = parseInt(await optionService.getOption('noteRevisionSnapshotTimeInterval'));

    const revisionCutoff = dateUtils.dateStr(new Date(now.getTime() - noteRevisionSnapshotTimeInterval * 1000));

    const existingnoteRevisionId = await sql.getValue(
        "SELECT noteRevisionId FROM note_revisions WHERE noteId = ? AND dateModifiedTo >= ?", [note.noteId, revisionCutoff]);

    const msSinceDateCreated = now.getTime() - dateUtils.parseDateTime(note.dateCreated).getTime();

    if (note.type !== 'file'
        && labelsMap.disableVersioning !== 'true'
        && !existingnoteRevisionId
        && msSinceDateCreated >= noteRevisionSnapshotTimeInterval * 1000) {

        await new NoteRevision({
            noteId: note.noteId,
            // title and text should be decrypted now
            title: note.title,
            content: note.content,
            isProtected: 0, // will be fixed in the protectNoteRevisions() call
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

    note.title = noteUpdates.title;
    note.setContent(noteUpdates.content);
    note.isProtected = noteUpdates.isProtected;
    await note.save();

    await saveNoteImages(note);

    await protectNoteRevisions(note);
}

async function deleteNote(branch) {
    if (!branch || branch.isDeleted === 1) {
        return;
    }

    branch.isDeleted = true;
    await branch.save();

    const note = await branch.getNote();
    const notDeletedBranches = await note.getBranches();

    if (notDeletedBranches.length === 0) {
        note.isDeleted = true;
        await note.save();

        for (const childBranch of await note.getChildBranches()) {
            await deleteNote(childBranch);
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