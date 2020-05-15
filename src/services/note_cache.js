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
/** @type {Object.<String, Attribute[]>} Points from attribute type-name to list of attributes them */
let attributeIndex;

/** @return {Attribute[]} */
function findAttributes(type, name) {
    return attributeIndex[`${type}-${name}`] || [];
}

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
        this.inheritableAttributeCache = null;

        /** @param {Attribute[]} */
        this.targetRelations = [];

        /** @param {string|null} */
        this.flatTextCache = null;

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

            for (const attr of this.attributeCache) {
                if (attr.isInheritable) {
                    this.inheritableAttributeCache.push(attr);
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

    /**
     * @return {string} - returns flattened textual representation of note, prefixes and attributes usable for searching
     */
    get flatText() {
        if (!this.flatTextCache) {
            if (this.isHideInAutocompleteOrArchived) {
                this.flatTextCache = " "; // can't be empty
                return this.flatTextCache;
            }

            this.flatTextCache = '';

            for (const branch of this.parentBranches) {
                if (branch.prefix) {
                    this.flatTextCache += branch.prefix + ' - ';
                }
            }

            this.flatTextCache += this.title;

            for (const attr of this.attributes) {
                // it's best to use space as separator since spaces are filtered from the search string by the tokenization into words
                this.flatTextCache += (attr.type === 'label' ? '#' : '@') + attr.name;

                if (attr.value) {
                    this.flatTextCache += '=' + attr.value;
                }
            }

            this.flatTextCache = this.flatTextCache.toLowerCase();
        }

        return this.flatTextCache;
    }

    invalidateThisCache() {
        this.flatTextCache = null;

        this.attributeCache = null;
        this.inheritableAttributeCache = null;
    }

    invalidateSubtreeCaches() {
        this.invalidateThisCache();

        for (const childNote of this.children) {
            childNote.invalidateSubtreeCaches();
        }

        for (const targetRelation of this.targetRelations) {
            if (targetRelation.name === 'template') {
                const note = targetRelation.note;

                if (note) {
                    note.invalidateSubtreeCaches();
                }
            }
        }
    }

    invalidateSubtreeFlatText() {
        this.flatTextCache = null;

        for (const childNote of this.children) {
            childNote.invalidateSubtreeFlatText();
        }

        for (const targetRelation of this.targetRelations) {
            if (targetRelation.name === 'template') {
                const note = targetRelation.note;

                if (note) {
                    note.invalidateSubtreeFlatText();
                }
            }
        }
    }

    get isTemplate() {
        return !!this.targetRelations.find(rel => rel.name === 'template');
    }

    /** @return {Note[]} */
    get subtreeNotesIncludingTemplated() {
        const arr = [[this]];

        for (const childNote of this.children) {
            arr.push(childNote.subtreeNotesIncludingTemplated);
        }

        for (const targetRelation of this.targetRelations) {
            if (targetRelation.name === 'template') {
                const note = targetRelation.note;

                if (note) {
                    arr.push(note.subtreeNotesIncludingTemplated);
                }
            }
        }

        return arr.flat();
    }

    /** @return {Note[]} */
    get subtreeNotes() {
        const arr = [[this]];

        for (const childNote of this.children) {
            arr.push(childNote.subtreeNotes);
        }

        return arr.flat();
    }

    /** @return {Note[]} - returns only notes which are templated, does not include their subtrees
     *                     in effect returns notes which are influenced by note's non-inheritable attributes */
    get templatedNotes() {
        const arr = [this];

        for (const targetRelation of this.targetRelations) {
            if (targetRelation.name === 'template') {
                const note = targetRelation.note;

                if (note) {
                    arr.push(note);
                }
            }
        }

        return arr;
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

        const key = `${this.type-this.name}`;
        attributeIndex[key] = attributeIndex[key] || [];
        attributeIndex[key].push(this);

        const targetNote = this.targetNote;

        if (targetNote) {
            targetNote.targetRelations.push(this);
        }
    }

    get isAffectingSubtree() {
        return this.isInheritable
            || (this.type === 'relation' && this.name === 'template');
    }

    get note() {
        return notes[this.noteId];
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

const expression = {
    operator: 'and',
    operands: [
        {
            operator: 'exists',
            fieldName: 'hokus'
        }
    ]
};

class AndOp {
    constructor(subExpressions) {
        this.subExpressions = subExpressions;
    }

    execute(noteSet, searchContext) {
        for (const subExpression of this.subExpressions) {
            noteSet = subExpression.execute(noteSet, searchContext);
        }

        return noteSet;
    }
}

class OrOp {
    constructor(subExpressions) {
        this.subExpressions = subExpressions;
    }

    execute(noteSet, searchContext) {
        const resultNoteSet = new NoteSet();

        for (const subExpression of this.subExpressions) {
            resultNoteSet.mergeIn(subExpression.execute(noteSet, searchContext));
        }

        return resultNoteSet;
    }
}

class NoteSet {
    constructor(notes = []) {
        this.notes = notes;
    }

    add(note) {
        this.notes.push(note);
    }

    addAll(notes) {
        this.notes.push(...notes);
    }

    hasNoteId(noteId) {
        // TODO: optimize
        return !!this.notes.find(note => note.noteId === noteId);
    }

    mergeIn(anotherNoteSet) {
        this.notes = this.notes.concat(anotherNoteSet.arr);
    }
}

class ExistsOp {
    constructor(attributeType, attributeName) {
        this.attributeType = attributeType;
        this.attributeName = attributeName;
    }

    execute(noteSet) {
        const attrs = findAttributes(this.attributeType, this.attributeName);
        const resultNoteSet = new NoteSet();

        for (const attr of attrs) {
            const note = attr.note;

            if (noteSet.hasNoteId(note.noteId)) {
                if (attr.isInheritable) {
                    resultNoteSet.addAll(note.subtreeNotesIncludingTemplated);
                }
                else if (note.isTemplate) {
                    resultNoteSet.addAll(note.templatedNotes);
                }
                else {
                    resultNoteSet.add(note);
                }
            }
        }
    }
}

class EqualsOp {
    constructor(attributeType, attributeName, attributeValue) {
        this.attributeType = attributeType;
        this.attributeName = attributeName;
        this.attributeValue = attributeValue;
    }

    execute(noteSet) {
        const attrs = findAttributes(this.attributeType, this.attributeName);
        const resultNoteSet = new NoteSet();

        for (const attr of attrs) {
            const note = attr.note;

            if (noteSet.hasNoteId(note.noteId) && attr.value === this.attributeValue) {
                if (attr.isInheritable) {
                    resultNoteSet.addAll(note.subtreeNotesIncludingTemplated);
                }
                else if (note.isTemplate) {
                    resultNoteSet.addAll(note.templatedNotes);
                }
                else {
                    resultNoteSet.add(note);
                }
            }
        }
    }
}

class NoteContentFulltextOp {
    constructor(tokens) {
        this.tokens = tokens;
    }

    async execute(noteSet) {
        const resultNoteSet = new NoteSet();
        const wheres = this.tokens.map(token => "note_contents.content LIKE " + utils.prepareSqlForLike('%', token, '%'));

        const noteIds = await sql.getColumn(`
            SELECT notes.noteId 
            FROM notes
            JOIN note_contents ON notes.noteId = note_contents.noteId
            WHERE isDeleted = 0 AND isProtected = 0 AND ${wheres.join(' AND ')}`);

        const results = [];

        for (const noteId of noteIds) {
            if (noteSet.hasNoteId(noteId) && noteId in notes) {
                resultNoteSet.add(notes[noteId]);
            }
        }

        return results;
    }
}

class NoteCacheFulltextOp {
    constructor(tokens) {
        this.tokens = tokens;
    }

    execute(noteSet, searchContext) {
        const resultNoteSet = new NoteSet();

        const candidateNotes = this.getCandidateNotes(noteSet);

        for (const note of candidateNotes) {
            // autocomplete should be able to find notes by their noteIds as well (only leafs)
            if (this.tokens.length === 1 && note.noteId === this.tokens[0]) {
                this.searchDownThePath(note, [], [], resultNoteSet, searchContext);
                continue;
            }

            // for leaf note it doesn't matter if "archived" label is inheritable or not
            if (note.isArchived) {
                continue;
            }

            const foundAttrTokens = [];

            for (const attribute of note.ownedAttributes) {
                for (const token of this.tokens) {
                    if (attribute.name.toLowerCase().includes(token)
                        || attribute.value.toLowerCase().includes(token)) {
                        foundAttrTokens.push(token);
                    }
                }
            }

            for (const parentNote of note.parents) {
                const title = getNoteTitle(note.noteId, parentNote.noteId).toLowerCase();
                const foundTokens = foundAttrTokens.slice();

                for (const token of this.tokens) {
                    if (title.includes(token)) {
                        foundTokens.push(token);
                    }
                }

                if (foundTokens.length > 0) {
                    const remainingTokens = tokens.filter(token => !foundTokens.includes(token));

                    this.searchDownThePath(parentNote, remainingTokens, [note.noteId], resultNoteSet, searchContext);
                }
            }
        }

        return resultNoteSet;
    }

    /**
     * Returns noteIds which have at least one matching tokens
     *
     * @param {NoteSet} noteSet
     * @return {String[]}
     */
    getCandidateNotes(noteSet) {
        const candidateNotes = [];

        for (const note of noteSet.notes) {
            for (const token of this.tokens) {
                if (note.flatText.includes(token)) {
                    candidateNotes.push(note);
                    break;
                }
            }
        }

        return candidateNotes;
    }

    searchDownThePath(note, tokens, path, resultNoteSet, searchContext) {
        if (tokens.length === 0) {
            const retPath = getSomePath(note, path);

            if (retPath) {
                const noteId = retPath[retPath.length - 1];
                searchContext.noteIdToNotePath[noteId] = retPath;

                resultNoteSet.add(notes[noteId]);
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

                this.searchDownThePath(parentNote, remainingTokens, path.concat([note.noteId]), resultNoteSet, searchContext);
            }
            else {
                this.searchDownThePath(parentNote, tokens, path.concat([note.noteId]), resultNoteSet, searchContext);
            }
        }
    }
}

async function findNotesWithExpression(expression) {

    const hoistedNote = notes[hoistedNoteService.getHoistedNoteId()];
    const allNotes = (hoistedNote && hoistedNote.noteId !== 'root')
                     ? hoistedNote.subtreeNotes
                     : Object.values(notes);

    const allNoteSet = new NoteSet(allNotes);

    const searchContext = {
        noteIdToNotePath: {}
    };

    expression.execute(allNoteSet, searchContext);
}

async function findNotesWithFulltext(query, searchInContent) {
    if (!query.trim().length) {
        return [];
    }

    const tokens = query
        .trim() // necessary because even with .split() trailing spaces are tokens which causes havoc
        .toLowerCase()
        .split(/[ -]/)
        .filter(token => token !== '/'); // '/' is used as separator

    const cacheResults = findInNoteCache(tokens);

    const contentResults = searchInContent ? await findInNoteContent(tokens) : [];

    let results = cacheResults.concat(contentResults);

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

    highlightResults(apiResults, tokens);

    return apiResults;
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

function getBranch(childNoteId, parentNoteId) {
    return childParentToBranch[`${childNoteId}-${parentNoteId}`];
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
    let coeff = stringSimilarity.compareTwoStrings(sourceNote.flatText, candidateNote.flatText);

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
            note.flatTextCache = null;

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
                childNote.flatTextCache = null;
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
                // first invalidate and only then remove the attribute (otherwise invalidation wouldn't be complete)
                if (attr.isAffectingSubtree || note.isTemplate) {
                    note.invalidateSubtreeCaches();
                }

                note.ownedAttributes = note.ownedAttributes.filter(attr => attr.attributeId !== attributeId);

                const targetNote = attr.targetNote;

                if (targetNote) {
                    targetNote.targetRelations = targetNote.targetRelations.filter(rel => rel.attributeId !== attributeId);
                }
            }

            delete attributes[attributeId];
            delete attributeIndex[`${attr.type}-${attr.name}`];
        }
        else if (attributeId in attributes) {
            const attr = attributes[attributeId];

            // attr name and isInheritable are immutable
            attr.value = entity.value;

            if (attr.isAffectingSubtree || note.isTemplate) {
                note.invalidateSubtreeFlatText();
            }
            else {
                note.flatTextCache = null;
            }
        }
        else {
            const attr = new Attribute(entity);
            attributes[attributeId] = attr;

            if (note) {
                if (attr.isAffectingSubtree || note.isTemplate) {
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
    findNotesWithFulltext,
    getNotePath,
    getNoteTitleForPath,
    getNoteTitleFromPath,
    isAvailable,
    isArchived,
    isInAncestor,
    load,
    findSimilarNotes
};
