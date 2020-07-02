const utils = require('./utils');

const localSourceIds = {};

function generateSourceId() {
    const sourceId = utils.randomString(12);

    localSourceIds[sourceId] = true;

    return sourceId;
}

function isLocalSourceId(srcId) {
    return !!localSourceIds[srcId];
}

const currentSourceId = generateSourceId();

function getCurrentSourceId() {
    return currentSourceId;
}

module.exports = {
    generateSourceId,
    getCurrentSourceId,
    isLocalSourceId
};
