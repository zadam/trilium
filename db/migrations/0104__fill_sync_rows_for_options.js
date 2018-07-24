const syncTableService = require('../../src/services/sync_table');

// options has not been filled so far which caused problems with clean-slate sync.
module.exports = async () => await syncTableService.fillAllSyncRows();