const syncTableService = require('../../src/services/entity_changes.js');

// options has not been filled so far which caused problems with clean-slate sync.
module.exports = async () => await syncTableService.fillAllSyncRows();
