const appInfo = require('../services/app_info.js');
const eu = require('./etapi_utils.js');

function register(router) {
    eu.route(router, 'get', '/etapi/app-info', (req, res, next) => {
        res.status(200).json(appInfo);
    });
}

module.exports = {
    register
};
