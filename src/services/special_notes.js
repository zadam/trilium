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

function getLaunchBarRoot() {
    let note = becca.getNote('lb_root');

    if (!note) {
        note = noteService.createNewNote({
            branchId: 'lb_root',
            noteId: 'lb_root',
            title: 'Launch bar',
            type: 'text',
            content: '',
            parentNoteId: getHiddenRoot().noteId
        }).note;

        note.addLabel("iconClass", "bx bx-sidebar");
    }

    return note;
}

function getLaunchBarAvailableShortcutsRoot() {
    let note = becca.getNote('lb_availableshortcuts');

    if (!note) {
        note = noteService.createNewNote({
            branchId: 'lb_availableshortcuts',
            noteId: 'lb_availableshortcuts',
            title: 'Available shortcuts',
            type: 'text',
            content: '',
            parentNoteId: getLaunchBarRoot().noteId
        }).note;

        note.addLabel("iconClass", "bx bx-hide");
    }

    const branch = becca.getBranch('lb_availableshortcuts');
    if (!branch.isExpanded) {
        branch.isExpanded = true;
        branch.save();
    }

    return note;
}

function getLaunchBarVisibleShortcutsRoot() {
    let note = becca.getNote('lb_visibleshortcuts');

    if (!note) {
        note = noteService.createNewNote({
            branchId: 'lb_visibleshortcuts',
            noteId: 'lb_visibleshortcuts',
            title: 'Visible shortcuts',
            type: 'text',
            content: '',
            parentNoteId: getLaunchBarRoot().noteId
        }).note;

        note.addLabel("iconClass", "bx bx-show");
    }

    const branch = becca.getBranch('lb_visibleshortcuts');
    if (!branch.isExpanded) {
        branch.isExpanded = true;
        branch.save();
    }

    return note;
}

const shortcuts = [
    { id: 'lb_newnote', command: 'createNoteIntoInbox', title: 'New note', icon: 'bx bx-file-blank', isVisible: true },
    { id: 'lb_search', command: 'searchNotes', title: 'Search notes', icon: 'bx bx-search', isVisible: true },
    { id: 'lb_jumpto', command: 'jumpToNote', title: 'Jump to note', icon: 'bx bx-send', isVisible: true },
    { id: 'lb_notemap', targetNoteId: 'globalnotemap', title: 'Note map', icon: 'bx bx-map-alt', isVisible: true },
    { id: 'lb_recentchanges', command: 'showRecentChanges', title: 'Recent changes', icon: 'bx bx-history', isVisible: false },
    { id: 'lb_calendar', builtinWidget: 'calendar', title: 'Calendar', icon: 'bx bx-calendar', isVisible: true },
    { id: 'lb_spacer1', builtinWidget: 'spacer', title: 'Spacer', icon: 'bx bx-move-vertical', isVisible: true },
    { id: 'lb_pluginbuttons', builtinWidget: 'pluginButtons', title: 'Plugin buttons', icon: 'bx bx-move-vertical', isVisible: true },
    { id: 'lb_bookmarks', builtinWidget: 'bookmarks', title: 'Bookmarks', icon: 'bx bx-bookmark', isVisible: true },
    { id: 'lb_spacer2', builtinWidget: 'spacer', title: 'Spacer', icon: 'bx bx-move-vertical', isVisible: true },
    { id: 'lb_protectedsession', builtinWidget: 'protectedSession', title: 'Protected session', icon: 'bx bx bx-shield-quarter', isVisible: true },
    { id: 'lb_syncstatus', builtinWidget: 'syncStatus', title: 'Sync status', icon: 'bx bx-wifi', isVisible: true },
];

function createMissingSpecialNotes() {
    getSinglesNoteRoot();
    getSqlConsoleRoot();
    getGlobalNoteMap();
    getBulkActionNote();
    getLaunchBarRoot();
    getLaunchBarAvailableShortcutsRoot();
    getLaunchBarVisibleShortcutsRoot()

    for (const shortcut of shortcuts) {
        let note = becca.getNote(shortcut.id);
        const parentNoteId = shortcut.isVisible ? getLaunchBarVisibleShortcutsRoot().noteId : getLaunchBarAvailableShortcutsRoot().noteId;

        if (!note) {
            note = noteService.createNewNote({
                branchId: shortcut.id,
                noteId: shortcut.id,
                title: shortcut.title,
                type: 'text',
                content: '',
                parentNoteId: parentNoteId
            }).note;

            note.addLabel('builtinShortcut');
            note.addLabel('iconClass', shortcut.icon);

            if (shortcut.command) {
                note.addLabel('command', shortcut.command);
            } else if (shortcut.builtinWidget) {
                note.addLabel('builtinWidget', shortcut.builtinWidget);
            } else if (shortcut.targetNoteId) {
                note.addRelation('targetNote', shortcut.targetNoteId);
            } else {
                throw new Error(`No action defined for shortcut ${JSON.stringify(shortcut)}`);
            }
        }
    }

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
