const syncTableService = require('../../src/services/entity_changes.js');

module.exports = async () => {
    await syncTableService.fillAllSyncRows();
};
