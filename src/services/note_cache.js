const sql = require('./sql');
const sqlInit = require('./sql_init');
const eventService = require('./events');
const repository = require('./repository');
const protectedSessionService = require('./protected_session');
const utils = require('./utils');
const hoistedNoteService = require('./hoisted_note');
const stringSimilarity = require('string-similarity');

let loaded = false;
let loadedPromiseResolve;
/** Is resolved after the initial load */
let loadedPromise = new Promise(res => loadedPromiseResolve = res);

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

    prefixes = await sql.getMap(`
            SELECT noteId || '-' || parentNoteId, prefix 
            FROM branches 
            WHERE isDeleted = 0 AND prefix IS NOT NULL AND prefix != ''`);

    const branches = await sql.getRows(`SELECT branchId, noteId, parentNoteId FROM branches WHERE isDeleted = 0`);

    for (const rel of branches) {
        childToParent[rel.noteId] = childToParent[rel.noteId] || [];
        childToParent[rel.noteId].push(rel.parentNoteId);
        childParentToBranchId[`${rel.noteId}-${rel.parentNoteId}`] = rel.branchId;
    }

    archived = await sql.getMap(`SELECT noteId, isInheritable FROM attributes WHERE isDeleted = 0 AND type = 'label' AND name = 'archived'`);

    if (protectedSessionService.isProtectedSessionAvailable()) {
        await loadProtectedNotes();
    }

    for (const noteId in childToParent) {
        resortChildToParent(noteId);
    }

    loaded = true;
    loadedPromiseResolve();
}

async function loadProtectedNotes() {
    protectedNoteTitles = await sql.getMap(`SELECT noteId, title FROM notes WHERE isDeleted = 0 AND isProtected = 1`);

    for (const noteId in protectedNoteTitles) {
        protectedNoteTitles[noteId] = protectedSessionService.decryptString(protectedNoteTitles[noteId]);
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
        result.highlightedTitle = result.pathTitle;
    }

    for (const token of allTokens) {
        const tokenRegex = new RegExp("(" + utils.escapeRegExp(token) + ")", "gi");

        for (const result of results) {
            result.highlightedTitle = result.highlightedTitle.replace(tokenRegex, "{$1}");
        }
    }

    for (const result of results) {
        result.highlightedTitle = result.highlightedTitle
            .replace(/{/g, "<b>")
            .replace(/}/g, "</b>");
    }
}

async function findNotes(query) {
    if (!noteTitles || !query.length) {
        return [];
    }

    const allTokens = query
        .trim() // necessary because even with .split() trailing spaces are tokens which causes havoc
        .toLowerCase()
        .split(/[ -]/)
        .filter(token => token !== '/'); // '/' is used as separator

    const tokens = allTokens.slice();
    let results = [];

    let noteIds = Object.keys(noteTitles);

    if (protectedSessionService.isProtectedSessionAvailable()) {
        noteIds = [...new Set(noteIds.concat(Object.keys(protectedNoteTitles)))];
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
        const notePath = res.pathArray.join('/');

        return {
            noteId: res.noteId,
            branchId: res.branchId,
            path: notePath,
            pathTitle: res.titleArray.join(' / '),
            noteTitle: getNoteTitleFromPath(notePath)
        };
    });

    highlightResults(apiResults, allTokens);

    return apiResults;
}

function search(noteId, tokens, path, results) {
    if (tokens.length === 0) {
        const retPath = getSomePath(noteId, path);

        if (retPath && !isNotePathArchived(retPath)) {
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

function isNotePathArchived(notePath) {
    // if the note is archived directly
    if (archived[notePath[notePath.length - 1]] !== undefined) {
        return true;
    }

    for (let i = 0; i < notePath.length - 1; i++) {
        // this is going through parents so archived must be inheritable
        if (archived[notePath[i]] === 1) {
            return true;
        }
    }

    return false;
}

/**
 * This assumes that note is available. "archived" note means that there isn't a single non-archived note-path
 * leading to this note.
 *
 * @param noteId
 */
function isArchived(noteId) {
    const notePath = getSomePath(noteId);

    return isNotePathArchived(notePath);
}

/**
 * @param {string} noteId
 * @param {string} ancestorNoteId
 * @return {boolean} - true if given noteId has ancestorNoteId in any of its paths (even archived)
 */
function isInAncestor(noteId, ancestorNoteId) {
    if (ancestorNoteId === 'root' || ancestorNoteId === noteId) {
        return true;
    }

    for (const parentNoteId of childToParent[noteId] || []) {
        if (isInAncestor(parentNoteId, ancestorNoteId)) {
            return true;
        }
    }

    return false;
}

function getNoteTitleFromPath(notePath) {
    const pathArr = notePath.split("/");

    if (pathArr.length === 1) {
        return getNoteTitle(pathArr[0], 'root');
    }
    else {
        return getNoteTitle(pathArr[pathArr.length - 1], pathArr[pathArr.length - 2]);
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

/**
 * Returns notePath for noteId from cache. Note hoisting is respected.
 * Archived notes are also returned, but non-archived paths are preferred if available
 * - this means that archived paths is returned only if there's no non-archived path
 * - you can check whether returned path is archived using isArchived()
 */
function getSomePath(noteId, path = []) {
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
        const retPath = getSomePath(parentNoteId, path.concat([noteId]));

        if (retPath) {
            return retPath;
        }
    }

    return false;
}

function getNotePath(noteId) {
    const retPath = getSomePath(noteId);

    if (retPath) {
        const noteTitle = getNoteTitleForPath(retPath);
        const parentNoteId = childToParent[noteId][0];

        return {
            noteId: noteId,
            branchId: childParentToBranchId[`${noteId}-${parentNoteId}`],
            title: noteTitle,
            notePath: retPath,
            path: retPath.join('/')
        };
    }
}

function evaluateSimilarity(text1, text2, noteId, results) {
    let coeff = stringSimilarity.compareTwoStrings(text1, text2);

    if (coeff > 0.4) {
        const notePath = getSomePath(noteId);

        // this takes care of note hoisting
        if (!notePath) {
            return;
        }

        if (isNotePathArchived(notePath)) {
            coeff -= 0.2; // archived penalization
        }

        results.push({coeff, notePath, noteId});
    }
}

/**
 * Point of this is to break up long running sync process to avoid blocking
 * see https://snyk.io/blog/nodejs-how-even-quick-async-functions-can-block-the-event-loop-starve-io/
 */
function setImmediatePromise() {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), 0);
    });
}

async function evaluateSimilarityDict(title, dict, results) {
    let i = 0;

    for (const noteId in dict) {
        evaluateSimilarity(title, dict[noteId], noteId, results);

        i++;

        if (i % 200 === 0) {
            await setImmediatePromise();
        }
    }
}

async function findSimilarNotes(title) {
    const results = [];

    await evaluateSimilarityDict(title, noteTitles, results);

    if (protectedSessionService.isProtectedSessionAvailable()) {
        await evaluateSimilarityDict(title, protectedNoteTitles, results);
    }

    results.sort((a, b) => a.coeff > b.coeff ? -1 : 1);

    return results.length > 50 ? results.slice(0, 50) : results;
}

eventService.subscribe([eventService.ENTITY_CHANGED, eventService.ENTITY_DELETED, eventService.ENTITY_SYNCED],  async ({entityName, entity}) => {
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

        if (branch.isDeleted) {
            if (branch.noteId in childToParent) {
                childToParent[branch.noteId] = childToParent[branch.noteId].filter(noteId => noteId !== branch.parentNoteId);
            }

            delete prefixes[branch.noteId + '-' + branch.parentNoteId];
            delete childParentToBranchId[branch.noteId + '-' + branch.parentNoteId];
        }
        else {
            if (branch.prefix) {
                prefixes[branch.noteId + '-' + branch.parentNoteId] = branch.prefix;
            }

            childToParent[branch.noteId] = childToParent[branch.noteId] || [];

            if (!childToParent[branch.noteId].includes(branch.parentNoteId)) {
                childToParent[branch.noteId].push(branch.parentNoteId);
            }

            resortChildToParent(branch.noteId);

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

// will sort the childs so that non-archived are first and archived at the end
// this is done so that non-archived paths are always explored as first when searching for note path
function resortChildToParent(noteId) {
    if (!(noteId in childToParent)) {
        return;
    }

    childToParent[noteId].sort((a, b) => archived[a] === 1 ? 1 : -1);
}

/**
 * @param noteId
 * @returns {boolean} - true if note exists (is not deleted) and is available in current note hoisting
 */
function isAvailable(noteId) {
    const notePath = getNotePath(noteId);

    return !!notePath;
}

eventService.subscribe(eventService.ENTER_PROTECTED_SESSION, () => {
    loadedPromise.then(() => loadProtectedNotes());
});

sqlInit.dbReady.then(() => utils.stopWatch("Note cache load", load));

module.exports = {
    loadedPromise,
    findNotes,
    getNotePath,
    getNoteTitleForPath,
    getNoteTitleFromPath,
    isAvailable,
    isArchived,
    isInAncestor,
    load,
    findSimilarNotes
};