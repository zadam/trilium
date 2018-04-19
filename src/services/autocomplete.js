const sql = require('./sql');
const sqlInit = require('./sql_init');
const syncTableService = require('./sync_table');
const repository = require('./repository');

let noteTitles;
let noteIds;
const childToParent = {};
const hideInAutocomplete = {};

async function load() {
    noteTitles = await sql.getMap(`SELECT noteId, LOWER(title) FROM notes WHERE isDeleted = 0 AND isProtected = 0`);
    noteIds = Object.keys(noteTitles);

    const relations = await sql.getRows(`SELECT noteId, parentNoteId FROM branches WHERE isDeleted = 0`);

    for (const rel of relations) {
        childToParent[rel.noteId] = childToParent[rel.noteId] || [];
        childToParent[rel.noteId].push(rel.parentNoteId);
    }

    const hiddenLabels = await sql.getColumn(`SELECT noteId FROM labels WHERE isDeleted = 0 AND name = 'hideInAutocomplete'`);

    for (const noteId of hiddenLabels) {
        hideInAutocomplete[noteId] = true;
    }
}

function getResults(query) {
    if (!noteTitles || query.length <= 2) {
        return [];
    }

    const tokens = query.toLowerCase().split(" ");
    const results = [];

    for (const noteId in noteTitles) {
        if (hideInAutocomplete[noteId]) {
            continue;
        }

        const title = noteTitles[noteId];
        const foundTokens = [];

        for (const token of tokens) {
            if (title.includes(token)) {
                foundTokens.push(token);
            }
        }

        if (foundTokens.length > 0) {
            const remainingTokens = tokens.filter(token => !foundTokens.includes(token));

            search(childToParent[noteId], remainingTokens, [noteId], results);
        }
    }

    results.sort((a, b) => a.title < b.title ? -1 : 1);

    return results;
}

function search(noteIds, tokens, path, results) {
    if (!noteIds || noteIds.length === 0) {
        return;
    }

    if (tokens.length === 0) {
        const retPath = getSomePath(noteIds, path);

        if (retPath) {
            const noteTitle = getNoteTitle(retPath);

            results.push({
                title: noteTitle,
                path: retPath.join('/')
            });
        }

        return;
    }

    for (const noteId of noteIds) {
        if (results.length >= 200) {
            return;
        }

        if (noteId === 'root' || hideInAutocomplete[noteId]) {
            continue;
        }

        const title = noteTitles[noteId];
        const foundTokens = [];

        for (const token of tokens) {
            if (title.includes(token)) {
                foundTokens.push(token);
            }
        }

        if (foundTokens.length > 0) {
            const remainingTokens = tokens.filter(token => !foundTokens.includes(token));

            search(childToParent[noteId], remainingTokens, path.concat([noteId]), results);
        }
        else {
            search(childToParent[noteId], tokens, path.concat([noteId]), results);
        }
    }
}

function getNoteTitle(path) {
    const titles = path.map(noteId => noteTitles[noteId]);

    return titles.join(' / ');
}

function getSomePath(noteIds, path) {
    for (const noteId of noteIds) {
        if (noteId === 'root') {
            path.reverse();

            return path;
        }

        if (hideInAutocomplete[noteId]) {
            continue;
        }

        const parents = childToParent[noteId];

        if (!parents || parents.length === 0) {
            continue;
        }

        const retPath = getSomePath(parents, path.concat([noteId]));

        if (retPath) {
            return retPath;
        }
    }

    return false;
}

syncTableService.addListener(async (entityName, entityId) => {
    if (entityName === 'notes') {
        const note = await repository.getNote(entityId);

        if (note.isDeleted) {
            delete noteTitles[note.noteId];
            delete childToParent[note.noteId];
        }
        else {
            noteTitles[note.noteId] = note.title;
        }
    }
    else if (entityName === 'labels') {
        const label = await repository.getLabel(entityId);

        if (label.name === 'hideInAutocomplete') {
            // we're not using label object directly, since there might be other non-deleted hideInAutocomplete label
            const hideLabel = await repository.getEntity(`SELECT * FROM labels WHERE isDeleted = 0 
                                 AND name = 'hideInAutocomplete' AND noteId = ?`, [label.noteId]);

            if (hideLabel) {
                hideInAutocomplete[label.noteId] = true;
            }
            else {
                delete hideInAutocomplete[label.noteId];
            }
        }
    }
});

sqlInit.dbReady.then(load);

module.exports = {
    getResults
};