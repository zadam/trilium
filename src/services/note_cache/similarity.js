const noteCache = require('./note_cache');
const noteCacheService = require('./note_cache_service.js');
const dateUtils = require('../date_utils');

function computeScore(candidateNote, dates) {
    let score = 0;



    /**
     * We want to improve standing of notes which have been created in similar time to each other since
     * there's a good chance they are related.
     *
     * But there's an exception - if they were created really close to each other (withing few seconds) then
     * they are probably part of the import and not created by hand - these OTOH should not benefit.
     */
    const {utcDateCreated} = candidateNote;

    if (utcDateCreated >= dates.minDate && utcDateCreated <= dates.maxDate
        && utcDateCreated < dates.minExcludedDate && utcDateCreated > dates.maxExcludedDate) {

        score += 0.3;
    }

    return score;
}

function evaluateSimilarity(sourceNote, candidateNote, rewardMap, dates, results) {
    let score = computeScore(candidateNote, rewardMap, dates);

    if (score > 0.5) {
        const notePath = noteCacheService.getSomePath(candidateNote);

        // this takes care of note hoisting
        if (!notePath) {
            return;
        }

        if (noteCacheService.isNotePathArchived(notePath)) {
            score -= 0.2; // archived penalization
        }

        results.push({score, notePath, noteId: candidateNote.noteId});
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

const IGNORED_ATTR_NAMES = [
    "includenotelink",
    "internallink",
    "imagelink",
    "relationmaplink"
];

/**
 * @param {Note} note
 */
function buildRewardMap(note) {
    const map = {};

    for (const ancestorNote of note.ancestors) {
        updateMap(map, ancestorNote.title, 0.4);

        for (const branch of ancestorNote.parentBranches) {
            updateMap(map, branch.prefix, 0.4);
        }
    }

    updateMap(map, note.type, 0.2);
    updateMap(map, processMime(note.mime), 0.3);

    updateMap(map, note.title, 1);

    for (const branch of note.parentBranches) {
        updateMap(map, branch.prefix, 1);
    }

    for (const attr of note.attributes) {
        const reward = note.noteId === attr.noteId ? 0.8 : 0.5;

        if (!IGNORED_ATTR_NAMES.includes(attr.name)) {
            updateMap(map, attr.name, reward);
        }

        updateMap(map, attr.value, reward);
    }

    return map;
}

function processMime(mime) {
    if (!mime) {
        return;
    }

    const chunks = mime.split('/');

    if (chunks.length < 2) {
        return;
    }

    // we're not interested in 'text/' or 'application/' prefix
    let str = chunks[1];

    if (str.startsWith('-x')) {
        str = str.substr(2);
    }

    return str;
}

function updateMap(map, text, baseReward) {
    if (!text) {
        return;
    }

    for (const word of text.split(/\W+/)) {
        map[word] = map[word] || 0;

        // reward grows with the length of matched string
        map[word] += baseReward * Math.sqrt(word.length);
    }
}

function tokenize(str) {
    return ;
}

async function findSimilarNotes(noteId) {
    const results = [];
    let i = 0;

    const baseNote = noteCache.notes[noteId];

    if (!baseNote) {
        return [];
    }

    const dateCreatedTs = dateUtils.parseDateTime(baseNote.utcDateCreated);

    const dates = {
        minDate: dateUtils.utcDateStr(new Date(dateCreatedTs - 1800)),
        minExcludedDate: dateUtils.utcDateStr(new Date(dateCreatedTs - 5)),
        maxExcludedDate: dateUtils.utcDateStr(new Date(dateCreatedTs + 5)),
        maxDate: dateUtils.utcDateStr(new Date(dateCreatedTs + 1800)),
    };

    const rewardMap = buildRewardMap(baseNote);

    for (const candidateNote of Object.values(noteCache.notes)) {
        if (candidateNote.noteId === baseNote.noteId) {
            continue;
        }

        evaluateSimilarity(baseNote, candidateNote, rewardMap, dates, results);

        i++;

        if (i % 200 === 0) {
            await setImmediatePromise();
        }
    }

    results.sort((a, b) => a.score > b.score ? -1 : 1);

    return results.length > 50 ? results.slice(0, 200) : results;
}

module.exports = {
    findSimilarNotes
};