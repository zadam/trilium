const utils = require('./utils');
const log = require('./log');

const sourceId = utils.randomString(16);

log.info("Using sourceId=" + sourceId);

module.exports = sourceId;