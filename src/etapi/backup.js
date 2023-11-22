const eu = require('./etapi_utils.js');
const backupService = require('../services/backup.js');

function register(router) {
    eu.route(router, 'put', '/etapi/backup/:backupName', async (req, res, next) => {
        await backupService.backupNow(req.params.backupName);

        res.sendStatus(204);
    });
}

module.exports = {
    register
};
