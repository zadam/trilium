const syncTableService = require('../../src/services/sync_table');

module.exports = async () => {
    await syncTableService.fillAllSyncRows();
};