const noteCache = require('./note_cache');
const noteCacheService = require('./note_cache_service.js');
const dateUtils = require('../date_utils');

function gatherRewards(rewardMap, text) {
    if (!text) {
        return 0;
    }

    let counter = 0;

    for (const word of text.toLowerCase().split(/\W+/)) {
        counter += rewardMap[word] || 0;
    }

    return counter;
}

function computeScore(candidateNote, ancestorNoteIds, rewardMap, dates) {
    let score =
        gatherRewards(rewardMap, candidateNote.title)
        + gatherRewards(rewardMap, candidateNote.type);
        + gatherRewards(rewardMap, trimMime(candidateNote.mime));

    for (const ancestorNote of candidateNote.ancestors) {
        if (!ancestorNoteIds.includes(ancestorNote.noteId)) {
            score += gatherRewards(rewardMap, ancestorNote.title);

            for (const branch of ancestorNote.parentBranches) {
                score += gatherRewards(rewardMap, branch.prefix);
            }
        }
    }

    for (const branch of candidateNote.parentBranches) {
        score += gatherRewards(rewardMap, branch.prefix);
    }

    for (const attr of candidateNote.attributes) {
        if (!IGNORED_ATTR_NAMES.includes(attr.name)) {
            score += gatherRewards(rewardMap, attr.name);
        }

        score += gatherRewards(rewardMap, attr.value);
    }

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

        score += 3;
    }

    return score;
}

function evaluateSimilarity(sourceNote, candidateNote, ancestorNoteIds, rewardMap, dates, results) {
    let score = computeScore(candidateNote, ancestorNoteIds, rewardMap, dates);

    if (score >= 4) {
        const notePath = noteCacheService.getSomePath(candidateNote);

        // this takes care of note hoisting
        if (!notePath) {
            return;
        }

        if (noteCacheService.isNotePathArchived(notePath)) {
            score -= 1; // archived penalization
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
        addToRewardMap(map, ancestorNote.title, 0.4);

        for (const branch of ancestorNote.parentBranches) {
            addToRewardMap(map, branch.prefix, 0.4);
        }
    }

    addToRewardMap(map, note.type, 0.2);
    addToRewardMap(map, trimMime(note.mime), 0.3);

    addToRewardMap(map, note.title, 1);

    for (const branch of note.parentBranches) {
        addToRewardMap(map, branch.prefix, 1);
    }

    for (const attr of note.attributes) {
        const reward = note.noteId === attr.noteId ? 0.8 : 0.5;

        if (!IGNORED_ATTR_NAMES.includes(attr.name)) {
            addToRewardMap(map, attr.name, reward);
        }

        addToRewardMap(map, attr.value, reward);
    }

    return map;
}

function trimMime(mime) {
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

function addToRewardMap(map, text, baseReward) {
    if (!text) {
        return;
    }

    for (const word of text.toLowerCase().split(/\W+/)) {
        if (word) {
            map[word] = map[word] || 0;

            // reward grows with the length of matched string
            map[word] += baseReward * Math.sqrt(word.length);
        }
    }
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
    const ancestorNoteIds = baseNote.ancestors.map(note => note.noteId);

    for (const candidateNote of Object.values(noteCache.notes)) {
        if (candidateNote.noteId === baseNote.noteId) {
            continue;
        }

        evaluateSimilarity(baseNote, candidateNote, ancestorNoteIds, rewardMap, dates, results);

        i++;

        if (i % 1000 === 0) {
            await setImmediatePromise();
        }
    }

    results.sort((a, b) => a.score > b.score ? -1 : 1);

    return results.length > 200 ? results.slice(0, 200) : results;
}

module.exports = {
    findSimilarNotes
};
