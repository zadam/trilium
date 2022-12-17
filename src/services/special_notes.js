const attributeService = require("./attributes");
const dateNoteService = require("./date_notes");
const becca = require("../becca/becca");
const noteService = require("./notes");
const cls = require("./cls");
const dateUtils = require("./date_utils");
const log = require("./log");
const hiddenSubtreeService = require("./hidden_subtree");
const searchService = require("./search/services/search.js");
const SearchContext = require("./search/search_context.js");

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

function createSqlConsole() {
    const {note} = noteService.createNewNote({
        parentNoteId: getMonthlyParentNoteId('sqlConsole'),
        title: 'SQL Console',
        content: "SELECT title, isDeleted, isProtected FROM notes WHERE noteId = ''\n\n\n\n",
        type: 'code',
        mime: 'text/x-sqlite;schema=trilium'
    });

    note.setLabel("sqlConsole", dateUtils.localNowDate());
    note.setLabel('iconClass', 'bx bx-data');
    note.setLabel('keepCurrentHoisting');

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
        parentNoteId: getMonthlyParentNoteId('search'),
        title: 'Search: ' + searchString,
        content: "",
        type: 'search',
        mime: 'application/json'
    });

    note.setLabel('searchString', searchString);
    note.setLabel('keepCurrentHoisting');

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

function getMonthlyParentNoteId(rootNoteId) {
    const month = dateUtils.localNowDate().substring(0, 7);
    const labelName = `${rootNoteId}MonthNote`;

    let monthNote = searchService.findFirstNoteWithQuery(`#${labelName}="${month}"`,
        new SearchContext({ancestorNoteId: rootNoteId}));

    if (!monthNote) {
        monthNote = noteService.createNewNote({
            parentNoteId: rootNoteId,
            title: month,
            content: '',
            isProtected: false,
            type: 'book'
        }).note

        monthNote.addLabel(labelName, month);
    }

    return monthNote.noteId;
}

function getHoistedNote() {
    return becca.getNote(cls.getHoistedNoteId());
}

function createScriptLauncher(parentNoteId, forceNoteId = null) {
    const note = noteService.createNewNote({
        noteId: forceNoteId,
        title: "Script Launcher",
        type: 'launcher',
        content: '',
        parentNoteId: parentNoteId
    }).note;

    note.addRelation('template', 'lbTplScriptLauncher');
    return note;
}

function createLauncher(parentNoteId, launcherType) {
    let note;

    if (launcherType === 'note') {
        note = noteService.createNewNote({
            title: "Note Launcher",
            type: 'launcher',
            content: '',
            parentNoteId: parentNoteId
        }).note;

        note.addRelation('template', 'lbTplNoteLauncher');
    } else if (launcherType === 'script') {
        note = createScriptLauncher(parentNoteId);
    } else if (launcherType === 'customWidget') {
        note = noteService.createNewNote({
            title: "Widget Launcher",
            type: 'launcher',
            content: '',
            parentNoteId: parentNoteId
        }).note;

        note.addRelation('template', 'lbTplCustomWidget');
    } else if (launcherType === 'spacer') {
        note = noteService.createNewNote({
            title: "Spacer",
            type: 'launcher',
            content: '',
            parentNoteId: parentNoteId
        }).note;

        note.addRelation('template', 'lbTplSpacer');
    } else {
        throw new Error(`Unrecognized launcher type '${launcherType}'`);
    }

    return {
        success: true,
        note
    };
}

function resetLauncher(noteId) {
    const note = becca.getNote(noteId);

    if (note.isLauncherConfig()) {
        if (note) {
            if (noteId === 'lbRoot') {
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
        log.info(`Note ${noteId} is not a resettable launcher note.`);
    }

    hiddenSubtreeService.checkHiddenSubtree();
}

/**
 * This exists to ease transition into the new launchbar, but it's not meant to be a permanent functionality.
 * Previously, the launchbar was fixed and the only way to add buttons was through this API, so a lot of buttons have been
 * created just to fill this user hole.
 *
 * Another use case would be for script-packages (of which only few exists) which could this way register automatically
 * into the launchbar. For such use cases this might be a usable replacement, but I'm not yet clear on that.
 */
function createOrUpdateScriptLauncherFromApi(opts) {
    const launcherId = opts.id || ("tb" + opts.title.replace(/[^[a-z0-9]/gi, ""));

    if (!opts.title) {
        throw new Error("Title is mandatory property to create or update a launcher.");
    } else if (!/^[a-z0-9]+$/i.test(launcherId)) {
        throw new Error(`Launcher ID can be alphanumeric only, '${launcherId}' given`);
    }

    const launcherNote = becca.getNote(launcherId)
        || createScriptLauncher('lbVisibleLaunchers', launcherId);

    launcherNote.title = opts.title;
    launcherNote.setContent("(" + opts.action + ")()");
    launcherNote.setLabel('scriptInLauncherContent'); // there's no target note, the script is in the launcher's content
    launcherNote.mime = 'application/javascript;env=frontend';
    launcherNote.save();

    if (opts.shortcut) {
        launcherNote.setLabel('keyboardShortcut', opts.shortcut);
    } else {
        launcherNote.removeLabel('keyboardShortcut');
    }

    if (opts.icon) {
        launcherNote.setLabel('iconClass', "bx bx-" + opts.icon);
    } else {
        launcherNote.removeLabel('iconClass');
    }

    return launcherNote;
}

module.exports = {
    getInboxNote,
    createSqlConsole,
    saveSqlConsole,
    createSearchNote,
    saveSearchNote,
    createLauncher,
    resetLauncher,
    createOrUpdateScriptLauncherFromApi
};
