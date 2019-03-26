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
const Link = require('../entities/link');

async function getHash(tableName, primaryKeyName, whereBranch) {
    // subselect is necessary to have correct ordering in GROUP_CONCAT
    const query = `SELECT GROUP_CONCAT(hash) FROM (SELECT hash FROM ${tableName} `
        + (whereBranch ? `WHERE ${whereBranch} ` : '') + `ORDER BY ${primaryKeyName})`;

    let contentToHash = await sql.getValue(query);

    if (!contentToHash) { // might be null in case of no rows
        contentToHash = "";
    }

    return utils.hash(contentToHash);
}

async function getHashes() {
    const startTime = new Date();

    const hashes = {
        notes: await getHash(Note.entityName, Note.primaryKeyName),
        note_contents: await getHash("note_contents", "noteId"),
        branches: await getHash(Branch.entityName, Branch.primaryKeyName),
        note_revisions: await getHash(NoteRevision.entityName, NoteRevision.primaryKeyName),
        recent_notes: await getHash(RecentNote.entityName, RecentNote.primaryKeyName),
        options: await getHash(Option.entityName, Option.primaryKeyName, "isSynced = 1"),
        attributes: await getHash(Attribute.entityName, Attribute.primaryKeyName),
        api_tokens: await getHash(ApiToken.entityName, ApiToken.primaryKeyName),
        links: await getHash(Link.entityName, Link.primaryKeyName)
    };

    const elapseTimeMs = Date.now() - startTime.getTime();

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