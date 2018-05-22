"use strict";

const sql = require('./sql');
const utils = require('./utils');
const log = require('./log');
const eventLogService = require('./event_log');
const messagingService = require('./messaging');
const ApiToken = require('../entities/api_token');
const Branch = require('../entities/branch');
const Image = require('../entities/image');
const Note = require('../entities/note');
const NoteImage = require('../entities/note_image');
const Label = require('../entities/label');
const NoteRevision = require('../entities/note_revision');
const RecentNote = require('../entities/recent_note');
const Option = require('../entities/option');

async function getHash(entityConstructor, whereBranch) {
    let contentToHash = await sql.getValue(`SELECT GROUP_CONCAT(hash) FROM ${entityConstructor.tableName} `
                + (whereBranch ? `WHERE ${whereBranch} ` : '') + `ORDER BY ${entityConstructor.primaryKeyName}`);

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
        images: await getHash(Image),
        note_images: await getHash(NoteImage),
        labels: await getHash(Label),
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

            await eventLogService.addEvent(`Content hash check for ${key} FAILED. Local is ${hashes[key]}, remote is ${resp.hashes[key]}`);

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