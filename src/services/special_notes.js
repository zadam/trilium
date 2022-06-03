const attributeService = require("./attributes");
const dateNoteService = require("./date_notes");
const becca = require("../becca/becca");
const noteService = require("./notes");
const cls = require("./cls");
const dateUtils = require("./date_utils");

function getInboxNote(date) {
    const hoistedNote = getHoistedNote();

    let inbox;

    if (!hoistedNote.isRoot()) {
        inbox = hoistedNote.searchNoteInSubtree('#hoistedInbox');

        if (!inbox) {
            inbox = hoistedNote.searchNoteInSubtree('#inbox');
        }

        if (!inbox) {
            inbox = hoistedNote;
        }
    }
    else {
        inbox = attributeService.getNoteWithLabel('inbox')
            || dateNoteService.getDayNote(date);
    }

    return inbox;
}

function getHiddenRoot() {
    let hidden = becca.getNote('hidden');

    if (!hidden) {
        hidden = noteService.createNewNote({
            branchId: 'hidden',
            noteId: 'hidden',
            title: 'hidden',
            type: 'text',
            content: '',
            parentNoteId: 'root'
        }).note;

        // isInheritable: false means that this notePath is automatically not preffered but at the same time
        // the flag is not inherited to the children
        hidden.addLabel('archived', "", false);
        hidden.addLabel('excludeFromNoteMap', "", true);
    }

    return hidden;
}

function getSearchRoot() {
    let searchRoot = becca.getNote('search');

    if (!searchRoot) {
        searchRoot = noteService.createNewNote({
            noteId: 'search',
            title: 'search',
            type: 'text',
            content: '',
            parentNoteId: getHiddenRoot().noteId
        }).note;
    }

    return searchRoot;
}

function getSinglesNoteRoot() {
    let singlesNoteRoot = becca.getNote('singles');

    if (!singlesNoteRoot) {
        singlesNoteRoot = noteService.createNewNote({
            noteId: 'singles',
            title: 'singles',
            type: 'text',
            content: '',
            parentNoteId: getHiddenRoot().noteId
        }).note;
    }

    return singlesNoteRoot;
}

function getGlobalNoteMap() {
    let globalNoteMap = becca.getNote('globalnotemap');

    if (!globalNoteMap) {
        globalNoteMap = noteService.createNewNote({
            noteId: 'globalnotemap',
            title: 'Global Note Map',
            type: 'note-map',
            content: '',
            parentNoteId: getSinglesNoteRoot().noteId
        }).note;

        globalNoteMap.addLabel('mapRootNoteId', 'hoisted');
    }

    return globalNoteMap;
}

function getSqlConsoleRoot() {
    let sqlConsoleRoot = becca.getNote('sqlconsole');

    if (!sqlConsoleRoot) {
        sqlConsoleRoot = noteService.createNewNote({
            noteId: 'sqlconsole',
            title: 'SQL Console',
            type: 'text',
            content: '',
            parentNoteId: getHiddenRoot().noteId
        }).note;
    }

    return sqlConsoleRoot;
}

function createSqlConsole() {
    const {note} = noteService.createNewNote({
        parentNoteId: getSqlConsoleRoot().noteId,
        title: 'SQL Console',
        content: "SELECT title, isDeleted, isProtected FROM notes WHERE noteId = ''\n\n\n\n",
        type: 'code',
        mime: 'text/x-sqlite;schema=trilium'
    });

    note.setLabel("sqlConsole", dateUtils.localNowDate());

    return note;
}

function saveSqlConsole(sqlConsoleNoteId) {
    const sqlConsoleNote = becca.getNote(sqlConsoleNoteId);
    const today = dateUtils.localNowDate();

    const sqlConsoleHome =
        attributeService.getNoteWithLabel('sqlConsoleHome')
        || dateNoteService.getDayNote(today);

    const result = sqlConsoleNote.cloneTo(sqlConsoleHome.noteId);

    for (const parentBranch of sqlConsoleNote.getParentBranches()) {
        if (parentBranch.parentNote.hasAncestor("hidden")) {
            parentBranch.markAsDeleted();
        }
    }

    return result;
}

function createSearchNote(searchString, ancestorNoteId) {
    const {note} = noteService.createNewNote({
        parentNoteId: getSearchRoot().noteId,
        title: 'Search: ' + searchString,
        content: "",
        type: 'search',
        mime: 'application/json'
    });

    note.setLabel('searchString', searchString);

    if (ancestorNoteId) {
        note.setRelation('ancestor', ancestorNoteId);
    }

    return note;
}

function getSearchHome() {
    const hoistedNote = getHoistedNote();

    if (!hoistedNote.isRoot()) {
        return hoistedNote.searchNoteInSubtree('#hoistedSearchHome')
            || hoistedNote.searchNoteInSubtree('#searchHome')
            || hoistedNote;
    } else {
        const today = dateUtils.localNowDate();

        return hoistedNote.searchNoteInSubtree('#searchHome')
            || dateNoteService.getDayNote(today);
    }
}

function saveSearchNote(searchNoteId) {
    const searchNote = becca.getNote(searchNoteId);
    const searchHome = getSearchHome();

    const result = searchNote.cloneTo(searchHome.noteId);

    for (const parentBranch of searchNote.getParentBranches()) {
        if (parentBranch.parentNote.hasAncestor("hidden")) {
            parentBranch.markAsDeleted();
        }
    }

    return result;
}

function getHoistedNote() {
    return becca.getNote(cls.getHoistedNoteId());
}

function getShareRoot() {
    let shareRoot = becca.getNote('share');

    if (!shareRoot) {
        shareRoot = noteService.createNewNote({
            branchId: 'share',
            noteId: 'share',
            title: 'Shared notes',
            type: 'text',
            content: '',
            parentNoteId: 'root'
        }).note;
    }

    return shareRoot;
}

function getBulkActionNote() {
    let bulkActionNote = becca.getNote('bulkaction');

    if (!bulkActionNote) {
        bulkActionNote = noteService.createNewNote({
            branchId: 'bulkaction',
            noteId: 'bulkaction',
            title: 'Bulk action',
            type: 'text',
            content: '',
            parentNoteId: getHiddenRoot().noteId
        }).note;
    }

    return bulkActionNote;
}

function createMissingSpecialNotes() {
    getSinglesNoteRoot();
    getSqlConsoleRoot();
    getGlobalNoteMap();
    getBulkActionNote();
    // share root is not automatically created since it's visible in the tree and many won't need it/use it

    const hidden = getHiddenRoot();

    if (!hidden.hasOwnedLabel('excludeFromNoteMap')) {
        hidden.addLabel('excludeFromNoteMap', "", true);
    }
}

module.exports = {
    getInboxNote,
    createSqlConsole,
    saveSqlConsole,
    createSearchNote,
    saveSearchNote,
    createMissingSpecialNotes,
    getShareRoot,
    getBulkActionNote,
};
