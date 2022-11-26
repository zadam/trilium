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
            type: 'doc',
            content: '',
            parentNoteId: 'root'
        }).note;

        // isInheritable: false means that this notePath is automatically not preffered but at the same time
        // the flag is not inherited to the children
        hidden.addLabel('archived', "", false);
        hidden.addLabel('excludeFromNoteMap', "", true);
        hidden.addLabel('iconClass', "bx bx-chip", false);
    }

    if (!hidden.hasOwnedLabel("docName")) {
        hidden.addLabel("docName", "hidden");
    }

    const MAX_POS = 999_999_999;

    const branch = hidden.getBranches()[0];
    if (branch.notePosition !== MAX_POS) {
        // we want to keep the hidden subtree always last, otherwise there will be problems with e.g. keyboard navigation
        // over tree when it's in the middle
        branch.notePosition = MAX_POS;
        branch.save();
    }

    return hidden;
}

function getSearchRoot() {
    let searchRoot = becca.getNote('search');

    if (!searchRoot) {
        searchRoot = noteService.createNewNote({
            branchId: 'search',
            noteId: 'search',
            title: 'search',
            type: 'doc',
            content: '',
            parentNoteId: getHiddenRoot().noteId
        }).note;
    }

    return searchRoot;
}

function getGlobalNoteMap() {
    let globalNoteMap = becca.getNote('globalnotemap');

    if (!globalNoteMap) {
        globalNoteMap = noteService.createNewNote({
            branchId: 'globalnotemap',
            noteId: 'globalnotemap',
            title: 'Global Note Map',
            type: 'note-map',
            content: '',
            parentNoteId: getHiddenRoot().noteId
        }).note;

        globalNoteMap.addLabel('mapRootNoteId', 'hoisted');
    }

    return globalNoteMap;
}

function getSqlConsoleRoot() {
    let sqlConsoleRoot = becca.getNote('sqlconsole');

    if (!sqlConsoleRoot) {
        sqlConsoleRoot = noteService.createNewNote({
            branchId: 'sqlconsole',
            noteId: 'sqlconsole',
            title: 'SQL Console',
            type: 'doc',
            content: '',
            parentNoteId: getHiddenRoot().noteId
        }).note;

        sqlConsoleRoot.addLabel('iconClass', 'bx bx-data');
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
    note.setLabel('iconClass', 'bx bx-data');

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
        const hiddenRoot = getHiddenRoot();

        shareRoot = noteService.createNewNote({
            branchId: 'share',
            noteId: 'share',
            title: 'Shared notes',
            type: 'doc',
            content: '',
            parentNoteId: hiddenRoot.noteId
        }).note;
    }

    if (!shareRoot.hasOwnedLabel("docName")) {
        shareRoot.addLabel("docName", "share");
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
            type: 'doc',
            content: '',
            parentNoteId: getHiddenRoot().noteId
        }).note;

        note.addLabel("iconClass", "bx bx-sidebar");
        note.addLabel("docName", "launchbar_intro");
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
            type: 'doc',
            content: '',
            parentNoteId: getLaunchBarRoot().noteId
        }).note;

        note.addLabel("iconClass", "bx bx-hide");
        note.addLabel("docName", "launchbar_intro");
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
            type: 'doc',
            content: '',
            parentNoteId: getLaunchBarRoot().noteId
        }).note;

        note.addLabel("iconClass", "bx bx-show");
        note.addLabel("docName", "launchbar_intro");
    }

    const branch = becca.getBranch('lb_visibleshortcuts');
    if (!branch.isExpanded) {
        branch.isExpanded = true;
        branch.save();
    }

    return note;
}

const shortcuts = [
    // visible shortcuts:
    { id: 'lb_newnote', command: 'createNoteIntoInbox', title: 'New note', icon: 'bx bx-file-blank', isVisible: true },
    { id: 'lb_search', command: 'searchNotes', title: 'Search notes', icon: 'bx bx-search', isVisible: true },
    { id: 'lb_jumpto', command: 'jumpToNote', title: 'Jump to note', icon: 'bx bx-send', isVisible: true },
    { id: 'lb_notemap', targetNoteId: 'globalnotemap', title: 'Note map', icon: 'bx bx-map-alt', isVisible: true },
    { id: 'lb_calendar', builtinWidget: 'calendar', title: 'Calendar', icon: 'bx bx-calendar', isVisible: true },
    { id: 'lb_spacer1', builtinWidget: 'spacer', title: 'Spacer', icon: 'bx bx-move-vertical', isVisible: true, labels: [
            { type: "number", name: "baseSize", value: "40" },
            { type: "number", name: "growthFactor", value: "100" },
        ] },
    { id: 'lb_pluginbuttons', builtinWidget: 'pluginButtons', title: 'Plugin buttons', icon: 'bx bx-extension', isVisible: true },
    { id: 'lb_bookmarks', builtinWidget: 'bookmarks', title: 'Bookmarks', icon: 'bx bx-bookmark', isVisible: true },
    { id: 'lb_spacer2', builtinWidget: 'spacer', title: 'Spacer', icon: 'bx bx-move-vertical', isVisible: true, labels: [
            { type: "number", name: "baseSize", value: "40" },
            { type: "number", name: "growthFactor", value: "100" },
        ] },
    { id: 'lb_protectedsession', builtinWidget: 'protectedSession', title: 'Protected session', icon: 'bx bx bx-shield-quarter', isVisible: true },
    { id: 'lb_syncstatus', builtinWidget: 'syncStatus', title: 'Sync status', icon: 'bx bx-wifi', isVisible: true },

    // available shortcuts:
    { id: 'lb_recentchanges', command: 'showRecentChanges', title: 'Recent changes', icon: 'bx bx-history', isVisible: false },
    { id: 'lb_backinhistory', builtinWidget: 'backInHistoryButton', title: 'Back in history', icon: 'bx bxs-left-arrow-square', isVisible: false },
    { id: 'lb_forwardinhistory', builtinWidget: 'forwardInHistoryButton', title: 'Forward in history', icon: 'bx bxs-right-arrow-square', isVisible: false },
];

function createMissingSpecialNotes() {
    getSqlConsoleRoot();
    getGlobalNoteMap();
    getBulkActionNote();
    getLaunchBarRoot();
    getLaunchBarAvailableShortcutsRoot();
    getLaunchBarVisibleShortcutsRoot();
    getShareRoot();

    for (const shortcut of shortcuts) {
        let note = becca.getNote(shortcut.id);

        if (note) {
            continue;
        }

        const parentNoteId = shortcut.isVisible
            ? getLaunchBarVisibleShortcutsRoot().noteId
            : getLaunchBarAvailableShortcutsRoot().noteId;

        note = noteService.createNewNote({
            noteId: shortcut.id,
            title: shortcut.title,
            type: 'shortcut',
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

        for (const label of shortcut.labels || []) {
            note.addLabel('label:' + label.name, "promoted," + label.type);
            note.addLabel(label.name, label.value);
        }
    }

    // share root is not automatically created since it's visible in the tree and many won't need it/use it

    const hidden = getHiddenRoot();

    if (!hidden.hasOwnedLabel('excludeFromNoteMap')) {
        hidden.addLabel('excludeFromNoteMap', "", true);
    }
}

function createShortcut(parentNoteId, type) {
    let note;

    if (type === 'note') {
        note = noteService.createNewNote({
            title: "Note shortcut",
            type: 'shortcut',
            content: '',
            parentNoteId: parentNoteId
        }).note;

        note.addLabel('relation:targetNote', 'promoted');
        note.addLabel('docName', 'launchbar_note_shortcut');
    } else if (type === 'script') {
        note = noteService.createNewNote({
            title: "Script shortcut",
            type: 'shortcut',
            content: '',
            parentNoteId: parentNoteId
        }).note;

        note.addLabel('relation:script', 'promoted');
        note.addLabel('docName', 'launchbar_script_shortcut');
    } else if (type === 'widget') {
        note = noteService.createNewNote({
            title: "Widget shortcut",
            type: 'shortcut',
            content: '',
            parentNoteId: parentNoteId
        }).note;

        note.addLabel('relation:widget', 'promoted');
        note.addLabel('docName', 'launchbar_widget_shortcut');
    } else if (type === 'spacer') {
        note = noteService.createNewNote({
            title: "Spacer",
            type: 'shortcut',
            content: '',
            parentNoteId: parentNoteId
        }).note;

        note.addLabel('builtinWidget', 'spacer');
        note.addLabel('iconClass', 'bx bx-move-vertical');
        note.addLabel('label:baseSize', 'promoted,number');
        note.addLabel('baseSize', '40');
        note.addLabel('label:growthFactor', 'promoted,number');
        note.addLabel('growthFactor', '0');
        note.addLabel('docName', 'launchbar_spacer');
    } else {
        throw new Error(`Unrecognized shortcut type ${type}`);
    }

    return {
        success: true,
        note
    };
}

function resetShortcut(noteId) {
    if (noteId.startsWith('lb_')) {
        const note = becca.getNote(noteId);

        if (note) {
            if (noteId === 'lb_root') {
                // deleting hoisted notes are not allowed, so we just reset the children
                for (const childNote of note.getChildNotes()) {
                    childNote.deleteNote();
                }
            } else {
                note.deleteNote();
            }
        } else {
            log.info(`Note ${noteId} has not been found and cannot be reset.`);
        }
    } else {
        log.info(`Note ${noteId} is not a resettable shortcut note.`);
    }

    createMissingSpecialNotes();
}

module.exports = {
    getInboxNote,
    createSqlConsole,
    saveSqlConsole,
    createSearchNote,
    saveSearchNote,
    createMissingSpecialNotes,
    getShareRoot,
    getHiddenRoot,
    getBulkActionNote,
    createShortcut,
    resetShortcut
};
