import { Router } from 'express';
import appInfo = require('../services/app_info');
import eu = require('./etapi_utils');

function register(router: Router) {
    eu.route(router, 'get', '/etapi/app-info', (req, res, next) => {
        res.status(200).json(appInfo);
    });
}

export = {
    register
};
