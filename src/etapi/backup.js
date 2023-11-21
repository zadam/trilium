import eu from './etapi_utils.js'
import backupService from '../services/backup.js'

function register(router) {
    eu.route(router, 'put', '/etapi/backup/:backupName', async (req, res, next) => {
        await backupService.backupNow(req.params.backupName);

        res.sendStatus(204);
    });
}

export default {
    register
};
