const ipcMain = require('electron').ipcMain;

function init(app) {
    ipcMain.on('server-request', (event, arg) => {
        const req = {
            url: arg.url,
            method: arg.method,
            body: arg.data,
            headers: arg.headers,
            session: {
                loggedIn: true
            }
        };

        const respHeaders = {};

        const res = {
            statusCode: 200,
            getHeader: name => respHeaders[name],
            setHeader: (name, value) => {
                respHeaders[name] = value.toString();
                return res;
            },
            header: (name, value) => {
                respHeaders[name] = value.toString();
                return res;
            },
            status: statusCode => {
                res.statusCode = statusCode;
                return res;
            },
            send: obj => {
                event.sender.send('server-response', {
                    url: arg.url,
                    method: arg.method,
                    requestId: arg.requestId,
                    statusCode: res.statusCode,
                    headers: respHeaders,
                    body: obj
                });
            }
        };

        return app._router.handle(req, res, () => {});
    });
}

module.exports = init;
