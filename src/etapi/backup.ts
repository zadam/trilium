import { Router } from "express";

import eu = require('./etapi_utils');
import backupService = require('../services/backup');

function register(router: Router) {
    eu.route(router, 'put', '/etapi/backup/:backupName', async (req, res, next) => {
        await backupService.backupNow(req.params.backupName);

        res.sendStatus(204);
    });
}

export = {
    register
};
