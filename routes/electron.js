const ipcMain = require('electron').ipcMain;

function init(app) {
    ipcMain.on('server-request', (event, arg) => {
        const req = {};
        req.url = arg.url;
        req.method = arg.method;
        req.body = arg.data;
        req.headers = arg.headers;

        const res = {
            statusCode: 200
        };

        res.setHeader = function() {};

        res.status = function(statusCode) {
            res.statusCode = statusCode;
        };

        res.send = function(obj) {
            event.sender.send('server-response', {
                requestId: arg.requestId,
                statusCode: res.statusCode,
                body: obj
            });
        };

        return app._router.handle(req, res, () => {});
    });
}

module.exports = init;