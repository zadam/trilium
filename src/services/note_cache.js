const sql = require('./sql');
const sqlInit = require('./sql_init');
const eventService = require('./events');
const repository = require('./repository');
const protectedSessionService = require('./protected_session');
const utils = require('./utils');
const hoistedNoteService = require('./hoisted_note');

let loaded = false;
let noteTitles = {};
let protectedNoteTitles = {};
let noteIds;
let childParentToBranchId = {};
const childToParent = {};
let archived = {};

// key is 'childNoteId-parentNoteId' as a replacement for branchId which we don't use here
let prefixes = {};

async function load() {
    noteTitles = await sql.getMap(`SELECT noteId, title FROM notes WHERE isDeleted = 0 AND isProtected = 0`);
    noteIds = Object.keys(noteTitles);

    prefixes = await sql.getMap(`SELECT noteId || '-' || parentNoteId, prefix FROM branches WHERE prefix IS NOT NULL AND prefix != ''`);

    const relations = await sql.getRows(`SELECT branchId, noteId, parentNoteId FROM branches WHERE isDeleted = 0`);

    for (const rel of relations) {
        childToParent[rel.noteId] = childToParent[rel.noteId] || [];
        childToParent[rel.noteId].push(rel.parentNoteId);
        childParentToBranchId[`${rel.noteId}-${rel.parentNoteId}`] = rel.branchId;
    }

    archived = await sql.getMap(`SELECT noteId, isInheritable FROM attributes WHERE isDeleted = 0 AND type = 'label' AND name = 'archived'`);

    if (protectedSessionService.isProtectedSessionAvailable()) {
        await loadProtectedNotes();
    }

    loaded = true;
}

async function loadProtectedNotes() {
    protectedNoteTitles = await sql.getMap(`SELECT noteId, title FROM notes WHERE isDeleted = 0 AND isProtected = 1`);

    for (const noteId in protectedNoteTitles) {
        protectedNoteTitles[noteId] = protectedSessionService.decryptNoteTitle(noteId, protectedNoteTitles[noteId]);
    }
}

function highlightResults(results, allTokens) {
    // we remove < signs because they can cause trouble in matching and overwriting existing highlighted chunks
    // which would make the resulting HTML string invalid.
    // { and } are used for marking <b> and </b> tag (to avoid matches on single 'b' character)
    allTokens = allTokens.map(token => token.replace('/[<\{\}]/g', ''));

    // sort by the longest so we first highlight longest matches
    allTokens.sort((a, b) => a.length > b.length ? -1 : 1);

    for (const result of results) {
        result.highlighted = result.title;
    }

    for (const token of allTokens) {
        const tokenRegex = new RegExp("(" + utils.escapeRegExp(token) + ")", "gi");

        for (const result of results) {
            result.highlighted = result.highlighted.replace(tokenRegex, "{$1}");
        }
    }

    for (const result of results) {
        result.highlighted = result.highlighted
            .replace(/{/g, "<b>")
            .replace(/}/g, "</b>");
    }
}

async function findNotes(query) {
    if (!noteTitles || !query.length) {
        return [];
    }

    // trim is necessary because even with .split() trailing spaces are tokens which causes havoc
    // filtering '/' because it's used as separator
    const allTokens = query.trim().toLowerCase().split(" ").filter(token => token !== '/');
    const tokens = allTokens.slice();
    let results = [];

    let noteIds = Object.keys(noteTitles);

    if (protectedSessionService.isProtectedSessionAvailable()) {
        noteIds = noteIds.concat(Object.keys(protectedNoteTitles));
    }

    for (const noteId of noteIds) {
        // autocomplete should be able to find notes by their noteIds as well (only leafs)
        if (noteId === query) {
            search(noteId, [], [], results);
            continue;
        }

        // for leaf note it doesn't matter if "archived" label is inheritable or not
        if (noteId in archived) {
            continue;
        }

        const parents = childToParent[noteId];
        if (!parents) {
            continue;
        }

        for (const parentNoteId of parents) {
            // for parent note archived needs to be inheritable
            if (archived[parentNoteId] === 1) {
                continue;
            }

            const title = getNoteTitle(noteId, parentNoteId).toLowerCase();
            const foundTokens = [];

            for (const token of tokens) {
                if (title.includes(token)) {
                    foundTokens.push(token);
                }
            }

            if (foundTokens.length > 0) {
                const remainingTokens = tokens.filter(token => !foundTokens.includes(token));

                search(parentNoteId, remainingTokens, [noteId], results);
            }
        }
    }

    if (hoistedNoteService.getHoistedNoteId() !== 'root') {
        results = results.filter(res => res.pathArray.includes(hoistedNoteService.getHoistedNoteId()));
    }

    // sort results by depth of the note. This is based on the assumption that more important results
    // are closer to the note root.
    results.sort((a, b) => {
        if (a.pathArray.length === b.pathArray.length) {
            return a.title < b.title ? -1 : 1;
        }

        return a.pathArray.length < b.pathArray.length ? -1 : 1;
    });

    const apiResults = results.slice(0, 200).map(res => {
        return {
            noteId: res.noteId,
            branchId: res.branchId,
            path: res.pathArray.join('/'),
            title: res.titleArray.join(' / ')
        };
    });

    highlightResults(apiResults, allTokens);

    return apiResults;
}

function search(noteId, tokens, path, results) {
    if (tokens.length === 0) {
        const retPath = getSomePath(noteId, path);

        if (retPath) {
            const thisNoteId = retPath[retPath.length - 1];
            const thisParentNoteId = retPath[retPath.length - 2];

            results.push({
                noteId: thisNoteId,
                branchId: childParentToBranchId[`${thisNoteId}-${thisParentNoteId}`],
                pathArray: retPath,
                titleArray: getNoteTitleArrayForPath(retPath)
            });
        }

        return;
    }

    const parents = childToParent[noteId];
    if (!parents || noteId === 'root') {
        return;
    }

    for (const parentNoteId of parents) {
        // archived must be inheritable
        if (archived[parentNoteId] === 1) {
            continue;
        }

        const title = getNoteTitle(noteId, parentNoteId).toLowerCase();
        const foundTokens = [];

        for (const token of tokens) {
            if (title.includes(token)) {
                foundTokens.push(token);
            }
        }

        if (foundTokens.length > 0) {
            const remainingTokens = tokens.filter(token => !foundTokens.includes(token));

            search(parentNoteId, remainingTokens, path.concat([noteId]), results);
        }
        else {
            search(parentNoteId, tokens, path.concat([noteId]), results);
        }
    }
}

function getNoteTitle(noteId, parentNoteId) {
    const prefix = prefixes[noteId + '-' + parentNoteId];

    let title = noteTitles[noteId];

    if (!title) {
        if (protectedSessionService.isProtectedSessionAvailable()) {
            title = protectedNoteTitles[noteId];
        }
        else {
            title = '[protected]';
        }
    }

    return (prefix ? (prefix + ' - ') : '') + title;
}

function getNoteTitleArrayForPath(path) {
    const titles = [];

    if (path[0] === hoistedNoteService.getHoistedNoteId() && path.length === 1) {
        return [ getNoteTitle(hoistedNoteService.getHoistedNoteId()) ];
    }

    let parentNoteId = 'root';
    let hoistedNotePassed = false;

    for (const noteId of path) {
        // start collecting path segment titles only after hoisted note
        if (hoistedNotePassed) {
            const title = getNoteTitle(noteId, parentNoteId);

            titles.push(title);
        }

        if (noteId === hoistedNoteService.getHoistedNoteId()) {
            hoistedNotePassed = true;
        }

        parentNoteId = noteId;
    }

    return titles;
}

function getNoteTitleForPath(path) {
    const titles = getNoteTitleArrayForPath(path);

    return titles.join(' / ');
}

function getSomePath(noteId, path) {
    if (noteId === 'root') {
        path.push(noteId);
        path.reverse();

        if (!path.includes(hoistedNoteService.getHoistedNoteId())) {
            return false;
        }

        return path;
    }

    const parents = childToParent[noteId];
    if (!parents || parents.length === 0) {
        return false;
    }

    for (const parentNoteId of parents) {
        // archived applies here only if inheritable
        if (archived[parentNoteId] === 1) {
            continue;
        }

        const retPath = getSomePath(parentNoteId, path.concat([noteId]));

        if (retPath) {
            return retPath;
        }
    }

    return false;
}

function getNotePath(noteId) {
    const retPath = getSomePath(noteId, []);

    if (retPath) {
        const noteTitle = getNoteTitleForPath(retPath);
        const parentNoteId = childToParent[noteId][0];

        return {
            noteId: noteId,
            branchId: childParentToBranchId[`${noteId}-${parentNoteId}`],
            title: noteTitle,
            path: retPath.join('/')
        };
    }
}

eventService.subscribe([eventService.ENTITY_CHANGED, eventService.ENTITY_DELETED, eventService.ENTITY_SYNCED], async ({entityName, entity}) => {
    // note that entity can also be just POJO without methods if coming from sync

    if (!loaded) {
        return;
    }

    if (entityName === 'notes') {
        const note = entity;

        if (note.isDeleted) {
            delete noteTitles[note.noteId];
            delete childToParent[note.noteId];
        }
        else {
            if (note.isProtected) {
                // we can assume we have protected session since we managed to update
                // removing from the maps is important when switching between protected & unprotected
                protectedNoteTitles[note.noteId] = note.title;
                delete noteTitles[note.noteId];
            }
            else {
                noteTitles[note.noteId] = note.title;
                delete protectedNoteTitles[note.noteId];
            }
        }
    }
    else if (entityName === 'branches') {
        const branch = entity;

        // first we remove records for original placement (if they exist)
        childToParent[branch.noteId] = childToParent[branch.noteId] || [];
        childToParent[branch.noteId] = childToParent[branch.noteId].filter(noteId => noteId !== branch.origParentNoteId);

        delete prefixes[branch.noteId + '-' + branch.origParentNoteId];
        delete childParentToBranchId[branch.noteId + '-' + branch.origParentNoteId];

        if (!branch.isDeleted) {
            // ... and then we create new records
            if (branch.prefix) {
                prefixes[branch.noteId + '-' + branch.parentNoteId] = branch.prefix;
            }

            childToParent[branch.noteId].push(branch.parentNoteId);
            childParentToBranchId[branch.noteId + '-' + branch.parentNoteId] = branch.branchId;
        }
    }
    else if (entityName === 'attributes') {
        const attribute = entity;

        if (attribute.type === 'label' && attribute.name === 'archived') {
            // we're not using label object directly, since there might be other non-deleted archived label
            const archivedLabel = await repository.getEntity(`SELECT * FROM attributes WHERE isDeleted = 0 AND type = 'label' 
                                 AND name = 'archived' AND noteId = ?`, [attribute.noteId]);

            if (archivedLabel) {
                archived[attribute.noteId] = archivedLabel.isInheritable ? 1 : 0;
            }
            else {
                delete archived[attribute.noteId];
            }
        }
    }
});

/**
 * @param noteId
 * @returns {boolean} - true if note exists (is not deleted) and is not archived.
 */
function isAvailable(noteId) {
    const notePath = getNotePath(noteId);

    return !!notePath;
}

eventService.subscribe(eventService.ENTER_PROTECTED_SESSION, () => {
    if (loaded) {
        loadProtectedNotes();
    }
});

sqlInit.dbReady.then(() => utils.stopWatch("Autocomplete load", load));

module.exports = {
    findNotes,
    getNotePath,
    getNoteTitleForPath,
    isAvailable,
    load
};