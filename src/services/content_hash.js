"use strict";

const sql = require('./sql');
const utils = require('./utils');
const log = require('./log');

function getEntityHashes() {
    const startTime = new Date();

    const hashRows = sql.getRawRows(`
        SELECT entityName,
               entityId,
               hash
        FROM entity_changes 
        WHERE isSynced = 1
          AND entityName != 'note_reordering'`);

    // sorting is faster in memory
    // sorting by entityId is enough, hashes will be segmented by entityName later on anyway
    hashRows.sort((a, b) => a[1] < b[1] ? -1 : 1);

    const hashMap = {};

    for (const [entityName, entityId, hash] of hashRows) {
        const entityHashMap = hashMap[entityName] = hashMap[entityName] || {};

        const sector = entityId[0];

        entityHashMap[sector] = (entityHashMap[sector] || "") + hash
    }

    for (const entityHashMap of Object.values(hashMap)) {
        for (const key in entityHashMap) {
            entityHashMap[key] = utils.hash(entityHashMap[key]);
        }
    }

    const elapsedTimeMs = Date.now() - startTime.getTime();

    log.info(`Content hash computation took ${elapsedTimeMs}ms`);

    return hashMap;
}

function checkContentHashes(otherHashes) {
    const entityHashes = getEntityHashes();
    const failedChecks = [];

    for (const entityName in entityHashes) {
        const thisSectorHashes = entityHashes[entityName] || {};
        const otherSectorHashes = otherHashes[entityName] || {};

        const sectors = new Set(Object.keys(thisSectorHashes).concat(Object.keys(otherSectorHashes)));

        for (const sector of sectors) {
            if (thisSectorHashes[sector] !== otherSectorHashes[sector]) {
                log.info(`Content hash check for ${entityName} sector ${sector} FAILED. Local is ${thisSectorHashes[sector]}, remote is ${otherSectorHashes[sector]}`);

                failedChecks.push({ entityName, sector });
            }
        }
    }

    if (failedChecks.length === 0) {
        log.info("Content hash checks PASSED");
    }

    return failedChecks;
}

module.exports = {
    getEntityHashes,
    checkContentHashes
};
