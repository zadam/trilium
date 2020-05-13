const sql = require('./sql');
const sqlInit = require('./sql_init');
const eventService = require('./events');
const repository = require('./repository');
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

/** @type {Object.<String, Attribute[]>} */
let noteAttributeCache = {};

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
        this.isDecrypted = false;
        /** @param {Note[]} */
        this.parents = [];
        /** @param {Note[]} */
        this.children = [];
        /** @param {Attribute[]} */
        this.ownedAttributes = [];
    }

    /** @return {Attribute[]} */
    get attributes() {
        if (!(this.noteId in noteAttributeCache)) {
            const attrArrs = [
                this.ownedAttributes
            ];

            for (const templateAttr of this.ownedAttributes.filter(oa => oa.type === 'relation' && oa.name === 'template')) {
                const templateNote = notes[templateAttr.value];

                if (templateNote) {
                    attrArrs.push(templateNote.attributes);
                }
            }

            if (this.noteId !== 'root') {
                for (const parentNote of this.parents) {
                    attrArrs.push(parentNote.inheritableAttributes);
                }
            }

            noteAttributeCache[this.noteId] = attrArrs.flat();
        }

        return noteAttributeCache[this.noteId];
    }

    addSubTreeNoteIdsTo(noteIdSet) {
        noteIdSet.add(this.noteId);

        for (const child of this.children) {
            child.addSubTreeNoteIdsTo(noteIdSet);
        }
    }

    /** @return {Attribute[]} */
    get inheritableAttributes() {
        return this.attributes.filter(attr => attr.isInheritable);
    }

    hasAttribute(type, name) {
        return this.attributes.find(attr => attr.type === type && attr.name === name);
    }

    get isArchived() {
        return this.hasAttribute('label', 'archived');
    }

    get hasInheritableOwnedArchivedLabel() {
        return !!this.ownedAttributes.find(attr => attr.type === 'label' && attr.name === 'archived' && attr.isInheritable);
    }

    // will sort the parents so that non-archived are first and archived at the end
    // this is done so that non-archived paths are always explored as first when searching for note path
    resortParents() {
        this.parents.sort((a, b) => a.hasInheritableOwnedArchivedLabel ? 1 : -1);
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
    }
}

/** @type {Object.<String, String>} */
let fulltext = {};

/** @type {Object.<String, AttributeMeta>} */
let attributeMetas = {};

class AttributeMeta {
    constructor(attribute) {
        this.type = attribute.type;
        this.name = attribute.name;
        this.isInheritable = attribute.isInheritable;
        this.attributeIds = new Set(attribute.attributeId);
    }

    addAttribute(attribute) {
        this.attributeIds.add(attribute.attributeId);
        this.isInheritable = this.isInheritable || attribute.isInheritable;
    }

    updateAttribute(attribute) {
        if (attribute.isDeleted) {
            this.attributeIds.delete(attribute.attributeId);
        }
        else {
            this.attributeIds.add(attribute.attributeId);
        }

        this.isInheritable = !!this.attributeIds.find(attributeId => attributes[attributeId].isInheritable);
    }
}

function addToAttributeMeta(attribute) {
    const key = `${attribute.type}-${attribute.name}`;

    if (!(key in attributeMetas)) {
        attributeMetas[key] = new AttributeMeta(attribute);
    }
    else {
        attributeMetas[key].addAttribute(attribute);
    }
}

let loaded = false;
let loadedPromiseResolve;
/** Is resolved after the initial load */
let loadedPromise = new Promise(res => loadedPromiseResolve = res);

// key is 'childNoteId-parentNoteId' as a replacement for branchId which we don't use here
let prefixes = {};

async function getMappedRows(query, cb) {
    const map = {};
    const results = await sql.getRows(query, []);

    for (const row of results) {
        const keys = Object.keys(row);

        map[row[keys[0]]] = cb(row);
    }

    return map;
}

function updateFulltext(note) {
    let ft = note.title.toLowerCase();

    for (const attr of note.attributes) {
        ft += '|' + attr.name.toLowerCase();
        ft += '|' + attr.value.toLowerCase();
    }

    fulltext[note.noteId] = ft;
}

async function load() {
    notes = await getMappedRows(`SELECT noteId, title, isProtected FROM notes WHERE isDeleted = 0`,
        row => new Note(row));

    branches = await getMappedRows(`SELECT branchId, noteId, parentNoteId, prefix FROM branches WHERE isDeleted = 0`,
        row => new Branch(row));

    attributes = await getMappedRows(`SELECT attributeId, noteId, type, name, value, isInheritable FROM attributes WHERE isDeleted = 0`,
        row => new Attribute(row));

    for (const attr of Object.values(attributes)) {
        notes[attr.noteId].ownedAttributes.push(attr);

        addToAttributeMeta(attributes);
    }

    for (const branch of Object.values(branches)) {
        if (branch.branchId === 'root') {
            continue;
        }

        const childNote = notes[branch.noteId];
        const parentNote = branch.parentNote;

        if (!childNote) {
            console.log(`Cannot find child note ${branch.noteId} of a branch ${branch.branchId}`);
            continue;
        }

        childNote.parents.push(parentNote);
        parentNote.children.push(childNote);
    }

    if (protectedSessionService.isProtectedSessionAvailable()) {
        await decryptProtectedNotes();
    }

    for (const note of Object.values(notes)) {
        updateFulltext(note);
    }

    loaded = true;
    loadedPromiseResolve();
}

async function decryptProtectedNotes() {
    for (const note of notes) {
        if (note.isProtected && !note.isDecrypted) {
            note.title = protectedSessionService.decryptString(note.title);

            note.isDecrypted = true;
        }
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
 * @return {Set<String>}
 */
function getCandidateNotes(tokens) {
    const candidateNoteIds = new Set();

    for (const token of tokens) {
        for (const noteId in fulltext) {
            if (!fulltext[noteId].includes(token)) {
                continue;
            }

            candidateNoteIds.add(noteId);
            const note = notes[noteId];
            const inheritableAttrs = note.ownedAttributes.filter(attr => attr.isInheritable);

            searchingAttrs:
                // for matching inheritable attributes, include the whole note subtree to the candidates
                for (const attr of inheritableAttrs) {
                    const lcName = attr.name.toLowerCase();
                    const lcValue = attr.value.toLowerCase();

                    for (const token of tokens) {
                        if (lcName.includes(token) || lcValue.includes(token)) {
                            note.addSubTreeNoteIdsTo(candidateNoteIds);

                            break searchingAttrs;
                        }
                    }
                }
        }
    }
    return candidateNoteIds;
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

    const candidateNoteIds = getCandidateNotes(allTokens);

    // now we have set of noteIds which match at least one token

    let results = [];
    const tokens = allTokens.slice();

    for (const noteId of candidateNoteIds) {
        const note = notes[noteId];

        // autocomplete should be able to find notes by their noteIds as well (only leafs)
        if (noteId === query) {
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

                search(parentNote, remainingTokens, [noteId], results);
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

function evaluateSimilarity(text, note, results) {
    let coeff = stringSimilarity.compareTwoStrings(text, note.title);

    if (coeff > 0.4) {
        const notePath = getSomePath(note);

        // this takes care of note hoisting
        if (!notePath) {
            return;
        }

        if (isNotePathArchived(notePath)) {
            coeff -= 0.2; // archived penalization
        }

        results.push({coeff, notePath, noteId: note.noteId});
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

async function findSimilarNotes(title) {
    const results = [];
    let i = 0;

    for (const note of Object.values(notes)) {
        if (note.isProtected && !note.isDecrypted) {
            continue;
        }

        evaluateSimilarity(title, note, results);

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
            // we can assume we have protected session since we managed to update
            notes[noteId].title = entity.title;
            notes[noteId].isDecrypted = true;
        }
        else {
            notes[noteId] = new Note(entity);
        }
    }
    else if (entityName === 'branches') {
        const {branchId, noteId, parentNoteId} = entity;

        if (entity.isDeleted) {
            const childNote = notes[noteId];

            if (childNote) {
                childNote.parents = childNote.parents.filter(parent => parent.noteId !== parentNoteId);
            }

            const parentNote = notes[parentNoteId];

            if (parentNote) {
                childNote.children = childNote.children.filter(child => child.noteId !== noteId);
            }

            delete childParentToBranch[`${noteId}-${parentNoteId}`];
            delete branches[branchId];
        }
        else if (branchId in branches) {
            // only relevant thing which can change in a branch is prefix
            branches[branchId].prefix = entity.prefix;
        }
        else {
            branches[branchId] = new Branch(entity);

            const note = notes[entity.noteId];

            if (note) {
                note.resortParents();
            }
        }
    }
    else if (entityName === 'attributes') {
        const {attributeId, noteId} = entity;

        if (entity.isDeleted) {
            const note = notes[noteId];

            if (note) {
                note.ownedAttributes = note.ownedAttributes.filter(attr => attr.attributeId !== attributeId);
            }

            delete attributes[entity.attributeId];
        }
        else if (attributeId in attributes) {
            const attr = attributes[attributeId];

            // attr name cannot change
            attr.value = entity.value;
            attr.isInheritable = entity.isInheritable;
        }
        else {
            attributes[attributeId] = new Attribute(entity);

            const note = notes[noteId];

            if (note) {
                note.ownedAttributes.push(attributes[attributeId]);
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
