const log = require('../services/log.js');

function register(app) {
    app.use((err, req, res, next) => {
        if (err.code !== 'EBADCSRFTOKEN') {
            return next(err);
        }

        log.error(`Invalid CSRF token: ${req.headers['x-csrf-token']}, secret: ${req.cookies['_csrf']}`);

        err = new Error('Invalid CSRF token');
        err.status = 403;
        next(err);
    });

    // catch 404 and forward to error handler
    app.use((req, res, next) => {
        const err = new Error(`Router not found for request ${req.method} ${req.url}`);
        err.status = 404;
        next(err);
    });

    // error handler
    app.use((err, req, res, next) => {
        if (err && err.message && (
            (err.message.includes("Router not found for request") && err.message.includes(".js.map"))
            || (err.message.includes("Router not found for request") && err.message.includes(".css.map"))
        )) {
            // ignore
        } else {
            log.info(err);
        }

        res.status(err.status || 500);
        res.send({
            message: err.message
        });
    });
}

module.exports = {
    register
};
