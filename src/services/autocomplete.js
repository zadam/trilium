const sql = require('./sql');
const sqlInit = require('./sql_init');

let noteTitles;
let noteIds;
const childToParent = {};

async function load() {
    noteTitles = await sql.getMap(`SELECT noteId, LOWER(title) FROM notes WHERE isDeleted = 0 AND isProtected = 0`);
    noteIds = Object.keys(noteTitles);

    const relations = await sql.getRows(`SELECT noteId, parentNoteId FROM branches WHERE isDeleted = 0`);

    for (const rel of relations) {
        childToParent[rel.noteId] = childToParent[rel.noteId] || [];
        childToParent[rel.noteId].push(rel.parentNoteId);
    }
}

function getResults(query) {
    if (!noteTitles || query.length <= 2) {
        return [];
    }

    const tokens = query.toLowerCase().split(" ");
    const results = [];

    for (const noteId in noteTitles) {
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

    return results;
}

function search(noteIds, tokens, path, results) {
    if (!noteIds) {
        return;
    }

    for (const noteId of noteIds) {
        if (noteId === 'root') {
            if (tokens.length === 0) {
                const reversedPath = path.slice();
                reversedPath.reverse();

                const noteTitle = getNoteTitle(reversedPath);

                console.log(noteTitle);

                results.push({
                    title: noteTitle,
                    path: reversedPath.join('/')
                });
            }

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

sqlInit.dbReady.then(load);

module.exports = {
    getResults
};