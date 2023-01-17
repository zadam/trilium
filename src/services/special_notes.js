const attributeService = require("./attributes");
const dateNoteService = require("./date_notes");
const becca = require("../becca/becca");
const noteService = require("./notes");
const dateUtils = require("./date_utils");
const log = require("./log");
const hiddenSubtreeService = require("./hidden_subtree");
const hoistedNoteService = require("./hoisted_note");
const searchService = require("./search/services/search");
const SearchContext = require("./search/search_context");
const {LBTPL_NOTE_LAUNCHER, LBTPL_CUSTOM_WIDGET, LBTPL_SPACER, LBTPL_SCRIPT} = require("./hidden_subtree");

function getInboxNote(date) {
    const workspaceNote = hoistedNoteService.getWorkspaceNote();

    let inbox;

    if (!workspaceNote.isRoot()) {
        inbox = workspaceNote.searchNoteInSubtree('#workspaceInbox');

        if (!inbox) {
            inbox = workspaceNote.searchNoteInSubtree('#inbox');
        }

        if (!inbox) {
            inbox = workspaceNote;
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
        parentNoteId: getMonthlyParentNoteId('_sqlConsole', 'sqlConsole'),
        title: 'SQL Console - ' + dateUtils.localNowDate(),
        content: "SELECT title, isDeleted, isProtected FROM notes WHERE noteId = ''\n\n\n\n",
        type: 'code',
        mime: 'text/x-sqlite;schema=trilium'
    });

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
        if (parentBranch.parentNote.hasAncestor('_hidden')) {
            parentBranch.markAsDeleted();
        }
    }

    return result;
}

function createSearchNote(searchString, ancestorNoteId) {
    const {note} = noteService.createNewNote({
        parentNoteId: getMonthlyParentNoteId('_search', 'search'),
        title: `Search: ${searchString}`,
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
    const workspaceNote = hoistedNoteService.getWorkspaceNote();

    if (!workspaceNote.isRoot()) {
        return workspaceNote.searchNoteInSubtree('#workspaceSearchHome')
            || workspaceNote.searchNoteInSubtree('#searchHome')
            || workspaceNote;
    } else {
        const today = dateUtils.localNowDate();

        return workspaceNote.searchNoteInSubtree('#searchHome')
            || dateNoteService.getDayNote(today);
    }
}

function saveSearchNote(searchNoteId) {
    const searchNote = becca.getNote(searchNoteId);
    const searchHome = getSearchHome();

    const result = searchNote.cloneTo(searchHome.noteId);

    for (const parentBranch of searchNote.getParentBranches()) {
        if (parentBranch.parentNote.hasAncestor('_hidden')) {
            parentBranch.markAsDeleted();
        }
    }

    return result;
}

function getMonthlyParentNoteId(rootNoteId, prefix) {
    const month = dateUtils.localNowDate().substring(0, 7);
    const labelName = `${prefix}MonthNote`;

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

function createScriptLauncher(parentNoteId, forceNoteId = null) {
    const note = noteService.createNewNote({
        noteId: forceNoteId,
        title: "Script Launcher",
        type: 'launcher',
        content: '',
        parentNoteId: parentNoteId
    }).note;

    note.addRelation('template', LBTPL_SCRIPT);
    return note;
}

function createLauncher({parentNoteId, launcherType, noteId}) {
    let note;

    if (launcherType === 'note') {
        note = noteService.createNewNote({
            noteId: noteId,
            title: "Note Launcher",
            type: 'launcher',
            content: '',
            parentNoteId: parentNoteId
        }).note;

        note.addRelation('template', LBTPL_NOTE_LAUNCHER);
    } else if (launcherType === 'script') {
        note = createScriptLauncher(parentNoteId, noteId);
    } else if (launcherType === 'customWidget') {
        note = noteService.createNewNote({
            noteId: noteId,
            title: "Widget Launcher",
            type: 'launcher',
            content: '',
            parentNoteId: parentNoteId
        }).note;

        note.addRelation('template', LBTPL_CUSTOM_WIDGET);
    } else if (launcherType === 'spacer') {
        note = noteService.createNewNote({
            noteId: noteId,
            branchId: noteId,
            title: "Spacer",
            type: 'launcher',
            content: '',
            parentNoteId: parentNoteId
        }).note;

        note.addRelation('template', LBTPL_SPACER);
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

    if (note.isLaunchBarConfig()) {
        if (note) {
            if (noteId === '_lbRoot') {
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

    // the re-building deleted launchers will be done in handlers
}

/**
 * This exists to ease transition into the new launchbar, but it's not meant to be a permanent functionality.
 * Previously, the launchbar was fixed and the only way to add buttons was through this API, so a lot of buttons have been
 * created just to fill this user hole.
 *
 * Another use case was for script-packages (e.g. demo Task manager) which could this way register automatically/easily
 * into the launchbar - for this it's recommended to use backend API's createOrUpdateLauncher()
 */
function createOrUpdateScriptLauncherFromApi(opts) {
    if (opts.id && !/^[a-z0-9]+$/i.test(opts.id)) {
        throw new Error(`Launcher ID can be alphanumeric only, '${opts.id}' given`);
    }

    const launcherId = opts.id || (`tb_${opts.title.toLowerCase().replace(/[^[a-z0-9]/gi, "")}`);

    if (!opts.title) {
        throw new Error("Title is mandatory property to create or update a launcher.");
    }

    const launcherNote = becca.getNote(launcherId)
        || createScriptLauncher('_lbVisibleLaunchers', launcherId);

    launcherNote.title = opts.title;
    launcherNote.setContent(`(${opts.action})()`);
    launcherNote.setLabel('scriptInLauncherContent'); // there's no target note, the script is in the launcher's content
    launcherNote.mime = 'application/javascript;env=frontend';
    launcherNote.save();

    if (opts.shortcut) {
        launcherNote.setLabel('keyboardShortcut', opts.shortcut);
    } else {
        launcherNote.removeLabel('keyboardShortcut');
    }

    if (opts.icon) {
        launcherNote.setLabel('iconClass', `bx bx-${opts.icon}`);
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
