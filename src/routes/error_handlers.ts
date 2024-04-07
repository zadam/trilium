import { Application, NextFunction, Request, Response } from 'express';
import log = require('../services/log');

function register(app: Application) {
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
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
        (err as any).status = 404;
        next(err);
    });

    // error handler
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
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

export = {
    register
};
