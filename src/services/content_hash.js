"use strict";

const sql = require('./sql');
const utils = require('./utils');
const log = require('./log');
const eventLogService = require('./event_log');
const messagingService = require('./messaging');
const ApiToken = require('../entities/api_token');
const Branch = require('../entities/branch');
const Note = require('../entities/note');
const Attribute = require('../entities/attribute');
const NoteRevision = require('../entities/note_revision');
const RecentNote = require('../entities/recent_note');
const Option = require('../entities/option');

async function getHash(entityConstructor, whereBranch) {
    // subselect is necessary to have correct ordering in GROUP_CONCAT
    const query = `SELECT GROUP_CONCAT(hash) FROM (SELECT hash FROM ${entityConstructor.entityName} `
        + (whereBranch ? `WHERE ${whereBranch} ` : '') + `ORDER BY ${entityConstructor.primaryKeyName})`;

    let contentToHash = await sql.getValue(query);

    if (!contentToHash) { // might be null in case of no rows
        contentToHash = "";
    }

    return utils.hash(contentToHash);
}

async function getHashes() {
    const startTime = new Date();

    const hashes = {
        notes: await getHash(Note),
        branches: await getHash(Branch),
        note_revisions: await getHash(NoteRevision),
        recent_notes: await getHash(RecentNote),
        options: await getHash(Option, "isSynced = 1"),
        attributes: await getHash(Attribute),
        api_tokens: await getHash(ApiToken)
    };

    const elapseTimeMs = new Date().getTime() - startTime.getTime();

    log.info(`Content hash computation took ${elapseTimeMs}ms`);

    return hashes;
}

async function checkContentHashes(otherHashes) {
    const hashes = await getHashes();
    let allChecksPassed = true;

    for (const key in hashes) {
        if (hashes[key] !== otherHashes[key]) {
            allChecksPassed = false;

            await eventLogService.addEvent(`Content hash check for ${key} FAILED. Local is ${hashes[key]}, remote is ${otherHashes[key]}`);

            if (key !== 'recent_notes') {
                // let's not get alarmed about recent notes which get updated often and can cause failures in race conditions
                await messagingService.sendMessageToAllClients({type: 'sync-hash-check-failed'});
            }
        }
    }

    if (allChecksPassed) {
        log.info("Content hash checks PASSED");
    }
}

module.exports = {
    getHashes,
    checkContentHashes
};