"use strict";

const sql = require('../services/sql.js');
const eventService = require('../services/events.js');
const becca = require('./becca.js');
const sqlInit = require('../services/sql_init');
const log = require('../services/log');
const Note = require('./entities/note.js');
const Branch = require('./entities/branch.js');
const Attribute = require('./entities/attribute.js');
const Option = require('./entities/option.js');
const cls = require("../services/cls.js");

const beccaLoaded = new Promise((res, rej) => {
    sqlInit.dbReady.then(() => {
        load();

        cls.init(() => require('../services/options_init').initStartupOptions());

        res();
    });
});

function load() {
    const start = Date.now();
    becca.reset();

    for (const row of sql.iterateRows(`SELECT noteId, title, type, mime, isProtected, dateCreated, dateModified, utcDateCreated, utcDateModified FROM notes`, [])) {
        new Note(row);
    }

    for (const row of sql.iterateRows(`SELECT branchId, noteId, parentNoteId, prefix, notePosition, isExpanded, utcDateModified FROM branches WHERE isDeleted = 0`, [])) {
        new Branch(row);
    }

    for (const row of sql.iterateRows(`SELECT attributeId, noteId, type, name, value, isInheritable, position, utcDateModified FROM attributes WHERE isDeleted = 0`, [])) {
        new Attribute(row);
    }

    for (const row of sql.getRows(`SELECT name, value, isSynced, utcDateModified FROM options`)) {
        new Option(row);
    }

    becca.loaded = true;

    log.info(`Becca (note cache) load took ${Date.now() - start}ms`);
}

eventService.subscribe([eventService.ENTITY_CHANGED, eventService.ENTITY_CHANGE_SYNCED],  ({entityName, entity}) => {
    if (!becca.loaded) {
        return;
    }

    if (entityName === 'branches') {
        branchUpdated(entity);
    } else if (entityName === 'attributes') {
        attributeUpdated(entity);
    } else if (entityName === 'note_reordering') {
        noteReorderingUpdated(entity);
    }
});

eventService.subscribe([eventService.ENTITY_DELETED, eventService.ENTITY_DELETE_SYNCED],  ({entityName, entityId}) => {
    if (!becca.loaded) {
        return;
    }

    if (entityName === 'notes') {
        noteDeleted(entityId);
    } else if (entityName === 'branches') {
        branchDeleted(entityId);
    } else if (entityName === 'attributes') {
        attributeDeleted(entityId);
    }
});

function noteDeleted(noteId) {
    delete becca.notes[noteId];
}

function branchDeleted(branchId) {
    const branch = becca.branches[branchId];

    if (!branch) {
        return;
    }

    const childNote = becca.notes[branch.noteId];

    if (childNote) {
        childNote.parents = childNote.parents.filter(parent => parent.noteId !== branch.parentNoteId);
        childNote.parentBranches = childNote.parentBranches
            .filter(parentBranch => parentBranch.branchId !== branch.branchId);

        if (childNote.parents.length > 0) {
            childNote.invalidateSubTree();
        }
    }

    const parentNote = becca.notes[branch.parentNoteId];

    if (parentNote) {
        parentNote.children = parentNote.children.filter(child => child.noteId !== branch.noteId);
    }

    delete becca.childParentToBranch[`${branch.noteId}-${branch.parentNoteId}`];
    delete becca.branches[branch.branchId];
}

function branchUpdated(branch) {
    const childNote = becca.notes[branch.noteId];

    if (childNote) {
        childNote.flatTextCache = null;
        childNote.resortParents();
    }
}

function attributeDeleted(attributeId) {
    const attribute = becca.attributes[attributeId];

    if (!attribute) {
        return;
    }

    const note = becca.notes[attribute.noteId];

    if (note) {
        // first invalidate and only then remove the attribute (otherwise invalidation wouldn't be complete)
        if (attribute.isAffectingSubtree || note.isTemplate()) {
            note.invalidateSubTree();
        } else {
            note.invalidateThisCache();
        }

        note.ownedAttributes = note.ownedAttributes.filter(attr => attr.attributeId !== attribute.attributeId);

        const targetNote = attribute.targetNote;

        if (targetNote) {
            targetNote.targetRelations = targetNote.targetRelations.filter(rel => rel.attributeId !== attribute.attributeId);
        }
    }

    delete becca.attributes[attribute.attributeId];

    const key = `${attribute.type}-${attribute.name.toLowerCase()}`;

    if (key in becca.attributeIndex) {
        becca.attributeIndex[key] = becca.attributeIndex[key].filter(attr => attr.attributeId !== attribute.attributeId);
    }
}

function attributeUpdated(attribute) {
    const note = becca.notes[attribute.noteId];

    if (note) {
        if (attribute.isAffectingSubtree || note.isTemplate()) {
            note.invalidateSubTree();
        } else {
            note.invalidateThisCache();
        }
    }
}

function noteReorderingUpdated(branchIdList) {
    const parentNoteIds = new Set();

    for (const branchId in branchIdList) {
        const branch = becca.branches[branchId];

        if (branch) {
            branch.notePosition = branchIdList[branchId];

            parentNoteIds.add(branch.parentNoteId);
        }
    }
}

eventService.subscribe(eventService.ENTER_PROTECTED_SESSION, () => {
    try {
        becca.decryptProtectedNotes();
    }
    catch (e) {
        log.error(`Could not decrypt protected notes: ${e.message} ${e.stack}`);
    }
});

eventService.subscribe(eventService.LEAVE_PROTECTED_SESSION, load);

module.exports = {
    load,
    beccaLoaded
};
