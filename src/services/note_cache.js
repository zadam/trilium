const sql = require('./sql');
const sqlInit = require('./sql_init');
const eventService = require('./events');
const protectedSessionService = require('./protected_session');
const utils = require('./utils');
const hoistedNoteService = require('./hoisted_note');
const stringSimilarity = require('string-similarity');

/** @type {Object.<String, Note>} */
let notes;
/** @type {Object.<String, Branch>} */
let branches
/** @type {Object.<String, Attribute>} */
let attributes;

let childParentToBranch = {};

class Note {
    constructor(row) {
        /** @param {string} */
        this.noteId = row.noteId;
        /** @param {string} */
        this.title = row.title;
        /** @param {boolean} */
        this.isProtected = !!row.isProtected;
        /** @param {boolean} */
        this.isDecrypted = !row.isProtected || !!row.isContentAvailable;
        /** @param {Branch[]} */
        this.parentBranches = [];
        /** @param {Note[]} */
        this.parents = [];
        /** @param {Note[]} */
        this.children = [];
        /** @param {Attribute[]} */
        this.ownedAttributes = [];

        /** @param {Attribute[]|null} */
        this.attributeCache = null;
        /** @param {Attribute[]|null} */
        this.templateAttributeCache = null;
        /** @param {Attribute[]|null} */
        this.inheritableAttributeCache = null;

        /** @param {string|null} */
        this.fulltextCache = null;

        if (protectedSessionService.isProtectedSessionAvailable()) {
            decryptProtectedNote(this);
        }
    }

    /** @return {Attribute[]} */
    get attributes() {
        if (!this.attributeCache) {
            const parentAttributes = this.ownedAttributes.slice();

            if (this.noteId !== 'root') {
                for (const parentNote of this.parents) {
                    parentAttributes.push(...parentNote.inheritableAttributes);
                }
            }

            const templateAttributes = [];

            for (const ownedAttr of parentAttributes) { // parentAttributes so we process also inherited templates
                if (ownedAttr.type === 'relation' && ownedAttr.name === 'template') {
                    const templateNote = notes[ownedAttr.value];

                    if (templateNote) {
                        templateAttributes.push(...templateNote.attributes);
                    }
                }
            }

            this.attributeCache = parentAttributes.concat(templateAttributes);
            this.inheritableAttributeCache = [];
            this.templateAttributeCache = [];

            for (const attr of this.attributeCache) {
                if (attr.isInheritable) {
                    this.inheritableAttributeCache.push(attr);
                }

                if (attr.type === 'relation' && attr.name === 'template') {
                    this.templateAttributeCache.push(attr);
                }
            }
        }

        return this.attributeCache;
    }

    /** @return {Attribute[]} */
    get inheritableAttributes() {
        if (!this.inheritableAttributeCache) {
            this.attributes; // will refresh also this.inheritableAttributeCache
        }

        return this.inheritableAttributeCache;
    }

    /** @return {Attribute[]} */
    get templateAttributes() {
        if (!this.templateAttributeCache) {
            this.attributes; // will refresh also this.templateAttributeCache
        }

        return this.templateAttributeCache;
    }

    hasAttribute(type, name) {
        return this.attributes.find(attr => attr.type === type && attr.name === name);
    }

    get isArchived() {
        return this.hasAttribute('label', 'archived');
    }

    get isHideInAutocompleteOrArchived() {
        return this.attributes.find(attr =>
            attr.type === 'label'
            && ["archived", "hideInAutocomplete"].includes(attr.name));
    }

    get hasInheritableOwnedArchivedLabel() {
        return !!this.ownedAttributes.find(attr => attr.type === 'label' && attr.name === 'archived' && attr.isInheritable);
    }

    // will sort the parents so that non-archived are first and archived at the end
    // this is done so that non-archived paths are always explored as first when searching for note path
    resortParents() {
        this.parents.sort((a, b) => a.hasInheritableOwnedArchivedLabel ? 1 : -1);
    }

    get fulltext() {
        if (!this.fulltextCache) {
            if (this.isHideInAutocompleteOrArchived) {
                this.fulltextCache = " "; // can't be empty
                return this.fulltextCache;
            }

            this.fulltextCache = this.title.toLowerCase();

            for (const branch of this.parentBranches) {
                if (branch.prefix) {
                    this.fulltextCache += ' ' + branch.prefix;
                }
            }

            for (const attr of this.attributes) {
                // it's best to use space as separator since spaces are filtered from the search string by the tokenization into words
                this.fulltextCache += ' ' + attr.name.toLowerCase();

                if (attr.value) {
                    this.fulltextCache += ' ' + attr.value.toLowerCase();
                }
            }
        }

        return this.fulltextCache;
    }

    invalidateThisCache() {
        this.fulltextCache = null;

        this.attributeCache = null;
        this.templateAttributeCache = null;
        this.inheritableAttributeCache = null;
    }

    invalidateSubtreeCaches() {
        this.invalidateThisCache();

        for (const childNote of this.children) {
            childNote.invalidateSubtreeCaches();
        }

        for (const templateAttr of this.templateAttributes) {
            const targetNote = templateAttr.targetNote;

            if (targetNote) {
                targetNote.invalidateSubtreeCaches();
            }
        }
    }

    invalidateSubtreeFulltext() {
        this.fulltextCache = null;

        for (const childNote of this.children) {
            childNote.invalidateSubtreeFulltext();
        }

        for (const templateAttr of this.templateAttributes) {
            const targetNote = templateAttr.targetNote;

            if (targetNote) {
                targetNote.invalidateSubtreeFulltext();
            }
        }
    }
}

class Branch {
    constructor(row) {
        /** @param {string} */
        this.branchId = row.branchId;
        /** @param {string} */
        this.noteId = row.noteId;
        /** @param {string} */
        this.parentNoteId = row.parentNoteId;
        /** @param {string} */
        this.prefix = row.prefix;

        if (this.branchId === 'root') {
            return;
        }

        const childNote = notes[this.noteId];
        const parentNote = this.parentNote;

        if (!childNote) {
            console.log(`Cannot find child note ${this.noteId} of a branch ${this.branchId}`);
            return;
        }

        childNote.parents.push(parentNote);
        childNote.parentBranches.push(this);

        parentNote.children.push(childNote);

        childParentToBranch[`${this.noteId}-${this.parentNoteId}`] = this;
    }

    /** @return {Note} */
    get parentNote() {
        const note = notes[this.parentNoteId];

        if (!note) {
            console.log(`Cannot find note ${this.parentNoteId}`);
        }

        return note;
    }
}

class Attribute {
    constructor(row) {
        /** @param {string} */
        this.attributeId = row.attributeId;
        /** @param {string} */
        this.noteId = row.noteId;
        /** @param {string} */
        this.type = row.type;
        /** @param {string} */
        this.name = row.name;
        /** @param {string} */
        this.value = row.value;
        /** @param {boolean} */
        this.isInheritable = !!row.isInheritable;

        notes[this.noteId].ownedAttributes.push(this);
    }

    get isAffectingSubtree() {
        return this.isInheritable
            || (this.type === 'relation' && this.name === 'template');
    }

    get targetNote() {
        if (this.type === 'relation') {
            return notes[this.value];
        }
    }
}

let loaded = false;
let loadedPromiseResolve;
/** Is resolved after the initial load */
let loadedPromise = new Promise(res => loadedPromiseResolve = res);

async function getMappedRows(query, cb) {
    const map = {};
    const results = await sql.getRows(query, []);

    for (const row of results) {
        const keys = Object.keys(row);

        map[row[keys[0]]] = cb(row);
    }

    return map;
}

async function load() {
    notes = await getMappedRows(`SELECT noteId, title, isProtected FROM notes WHERE isDeleted = 0`,
        row => new Note(row));

    branches = await getMappedRows(`SELECT branchId, noteId, parentNoteId, prefix FROM branches WHERE isDeleted = 0`,
        row => new Branch(row));

    attributes = await getMappedRows(`SELECT attributeId, noteId, type, name, value, isInheritable FROM attributes WHERE isDeleted = 0`,
        row => new Attribute(row));

    loaded = true;
    loadedPromiseResolve();
}

function decryptProtectedNote(note) {
    if (note.isProtected && !note.isDecrypted && protectedSessionService.isProtectedSessionAvailable()) {
        note.title = protectedSessionService.decryptString(note.title);

        note.isDecrypted = true;
    }
}

async function decryptProtectedNotes() {
    for (const note of Object.values(notes)) {
        decryptProtectedNote(note);
    }
}

function formatAttribute(attr) {
    if (attr.type === 'relation') {
        return '@' + utils.escapeHtml(attr.name) + "=…";
    }
    else if (attr.type === 'label') {
        let label = '#' + utils.escapeHtml(attr.name);

        if (attr.value) {
            const val = /[^\w_-]/.test(attr.value) ? '"' + attr.value + '"' : attr.value;

            label += '=' + utils.escapeHtml(val);
        }

        return label;
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
        const note = notes[result.noteId];

        for (const attr of note.attributes) {
            if (allTokens.find(token => attr.name.includes(token) || attr.value.includes(token))) {
                result.pathTitle += ` <small>${formatAttribute(attr)}</small>`;
            }
        }

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

/**
 * Returns noteIds which have at least one matching tokens
 *
 * @param tokens
 * @return {String[]}
 */
function getCandidateNotes(tokens) {
    const candidateNotes = [];

    for (const note of Object.values(notes)) {
        for (const token of tokens) {
            if (note.fulltext.includes(token)) {
                candidateNotes.push(note);
                break;
            }
        }
    }

    return candidateNotes;
}

async function findNotes(query) {
    if (!query.length) {
        return [];
    }

    const allTokens = query
        .trim() // necessary because even with .split() trailing spaces are tokens which causes havoc
        .toLowerCase()
        .split(/[ -]/)
        .filter(token => token !== '/'); // '/' is used as separator

    const candidateNotes = getCandidateNotes(allTokens);

    // now we have set of noteIds which match at least one token

    let results = [];
    const tokens = allTokens.slice();

    for (const note of candidateNotes) {
        // autocomplete should be able to find notes by their noteIds as well (only leafs)
        if (note.noteId === query) {
            search(note, [], [], results);
            continue;
        }

        // for leaf note it doesn't matter if "archived" label is inheritable or not
        if (note.isArchived) {
            continue;
        }

        const foundAttrTokens = [];

        for (const attribute of note.ownedAttributes) {
            for (const token of tokens) {
                if (attribute.name.toLowerCase().includes(token)
                    || attribute.value.toLowerCase().includes(token)) {
                    foundAttrTokens.push(token);
                }
            }
        }

        for (const parentNote of note.parents) {
            const title = getNoteTitle(note.noteId, parentNote.noteId).toLowerCase();
            const foundTokens = foundAttrTokens.slice();

            for (const token of tokens) {
                if (title.includes(token)) {
                    foundTokens.push(token);
                }
            }

            if (foundTokens.length > 0) {
                const remainingTokens = tokens.filter(token => !foundTokens.includes(token));

                search(parentNote, remainingTokens, [note.noteId], results);
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

function getBranch(childNoteId, parentNoteId) {
    return childParentToBranch[`${childNoteId}-${parentNoteId}`];
}

function search(note, tokens, path, results) {
    if (tokens.length === 0) {
        const retPath = getSomePath(note, path);

        if (retPath) {
            const thisNoteId = retPath[retPath.length - 1];
            const thisParentNoteId = retPath[retPath.length - 2];

            results.push({
                noteId: thisNoteId,
                branchId: getBranch(thisNoteId, thisParentNoteId),
                pathArray: retPath,
                titleArray: getNoteTitleArrayForPath(retPath)
            });
        }

        return;
    }

    if (!note.parents.length === 0 || note.noteId === 'root') {
        return;
    }

    const foundAttrTokens = [];

    for (const attribute of note.ownedAttributes) {
        for (const token of tokens) {
            if (attribute.name.toLowerCase().includes(token)
                || attribute.value.toLowerCase().includes(token)) {
                foundAttrTokens.push(token);
            }
        }
    }

    for (const parentNote of note.parents) {
        const title = getNoteTitle(note.noteId, parentNote.noteId).toLowerCase();
        const foundTokens = foundAttrTokens.slice();

        for (const token of tokens) {
            if (title.includes(token)) {
                foundTokens.push(token);
            }
        }

        if (foundTokens.length > 0) {
            const remainingTokens = tokens.filter(token => !foundTokens.includes(token));

            search(parentNote, remainingTokens, path.concat([note.noteId]), results);
        }
        else {
            search(parentNote, tokens, path.concat([note.noteId]), results);
        }
    }
}

function isNotePathArchived(notePath) {
    const noteId = notePath[notePath.length - 1];
    const note = notes[noteId];

    if (note.isArchived) {
        return true;
    }

    for (let i = 0; i < notePath.length - 1; i++) {
        const note = notes[notePath[i]];

        // this is going through parents so archived must be inheritable
        if (note.hasInheritableOwnedArchivedLabel) {
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

    const note = notes[noteId];

    for (const parentNote of note.parents) {
        if (isInAncestor(parentNote.noteId, ancestorNoteId)) {
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

function getNoteTitle(childNoteId, parentNoteId) {
    const childNote = notes[childNoteId];
    const parentNote = notes[parentNoteId];

    let title;

    if (childNote.isProtected) {
        title = protectedSessionService.isProtectedSessionAvailable() ? childNote.title : '[protected]';
    }
    else {
        title = childNote.title;
    }

    const branch = parentNote ? getBranch(childNote.noteId, parentNote.noteId) : null;

    return ((branch && branch.prefix) ? `${branch.prefix} - ` : '') + title;
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
function getSomePath(note, path = []) {
    if (note.noteId === 'root') {
        path.push(note.noteId);
        path.reverse();

        if (!path.includes(hoistedNoteService.getHoistedNoteId())) {
            return false;
        }

        return path;
    }

    const parents = note.parents;
    if (parents.length === 0) {
        return false;
    }

    for (const parentNote of parents) {
        const retPath = getSomePath(parentNote, path.concat([note.noteId]));

        if (retPath) {
            return retPath;
        }
    }

    return false;
}

function getNotePath(noteId) {
    const note = notes[noteId];
    const retPath = getSomePath(note);

    if (retPath) {
        const noteTitle = getNoteTitleForPath(retPath);
        const parentNote = note.parents[0];

        return {
            noteId: noteId,
            branchId: getBranch(noteId, parentNote.noteId).branchId,
            title: noteTitle,
            notePath: retPath,
            path: retPath.join('/')
        };
    }
}

function evaluateSimilarity(sourceNote, candidateNote, results) {
    let coeff = stringSimilarity.compareTwoStrings(sourceNote.fulltext, candidateNote.fulltext);

    if (coeff > 0.4) {
        const notePath = getSomePath(candidateNote);

        // this takes care of note hoisting
        if (!notePath) {
            return;
        }

        if (isNotePathArchived(notePath)) {
            coeff -= 0.2; // archived penalization
        }

        results.push({coeff, notePath, noteId: candidateNote.noteId});
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

async function findSimilarNotes(noteId) {
    const results = [];
    let i = 0;

    const origNote = notes[noteId];

    if (!origNote) {
        return [];
    }

    for (const note of Object.values(notes)) {
        if (note.isProtected && !note.isDecrypted) {
            continue;
        }

        evaluateSimilarity(origNote, note, results);

        i++;

        if (i % 200 === 0) {
            await setImmediatePromise();
        }
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
        const {noteId} = entity;

        if (entity.isDeleted) {
            delete notes[noteId];
        }
        else if (noteId in notes) {
            const note = notes[noteId];

            // we can assume we have protected session since we managed to update
            note.title = entity.title;
            note.isProtected = entity.isProtected;
            note.isDecrypted = !entity.isProtected || !!entity.isContentAvailable;
            note.fulltextCache = null;

            decryptProtectedNote(note);
        }
        else {
            const note = new Note(entity);
            notes[noteId] = note;

            decryptProtectedNote(note);
        }
    }
    else if (entityName === 'branches') {
        const {branchId, noteId, parentNoteId} = entity;
        const childNote = notes[noteId];

        if (entity.isDeleted) {
            if (childNote) {
                childNote.parents = childNote.parents.filter(parent => parent.noteId !== parentNoteId);
                childNote.parentBranches = childNote.parentBranches.filter(branch => branch.branchId !== branchId);

                if (childNote.parents.length > 0) {
                    childNote.invalidateSubtreeCaches();
                }
            }

            const parentNote = notes[parentNoteId];

            if (parentNote) {
                parentNote.children = parentNote.children.filter(child => child.noteId !== noteId);
            }

            delete childParentToBranch[`${noteId}-${parentNoteId}`];
            delete branches[branchId];
        }
        else if (branchId in branches) {
            // only relevant thing which can change in a branch is prefix
            branches[branchId].prefix = entity.prefix;

            if (childNote) {
                childNote.fulltextCache = null;
            }
        }
        else {
            branches[branchId] = new Branch(entity);

            if (childNote) {
                childNote.resortParents();
            }
        }
    }
    else if (entityName === 'attributes') {
        const {attributeId, noteId} = entity;
        const note = notes[noteId];
        const attr = attributes[attributeId];

        if (entity.isDeleted) {
            if (note && attr) {
                note.ownedAttributes = note.ownedAttributes.filter(attr => attr.attributeId !== attributeId);

                if (attr.isAffectingSubtree) {
                    note.invalidateSubtreeCaches();
                }
            }

            delete attributes[attributeId];
        }
        else if (attributeId in attributes) {
            const attr = attributes[attributeId];

            // attr name and isInheritable are immutable
            attr.value = entity.value;

            if (attr.isAffectingSubtree) {
                note.invalidateSubtreeFulltext();
            }
            else {
                note.fulltextCache = null;
            }
        }
        else {
            const attr = new Attribute(entity);
            attributes[attributeId] = attr;

            if (note) {
                if (attr.isAffectingSubtree) {
                    note.invalidateSubtreeCaches();
                }
                else {
                    this.invalidateThisCache();
                }
            }
        }
    }
});

/**
 * @param noteId
 * @returns {boolean} - true if note exists (is not deleted) and is available in current note hoisting
 */
function isAvailable(noteId) {
    const notePath = getNotePath(noteId);

    return !!notePath;
}

eventService.subscribe(eventService.ENTER_PROTECTED_SESSION, () => {
    loadedPromise.then(() => decryptProtectedNotes());
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
