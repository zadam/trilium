import log = require('../services/log');
import fileService = require('./api/files');
import scriptService = require('../services/script');
import cls = require('../services/cls');
import sql = require('../services/sql');
import becca = require('../becca/becca');
import { Request, Response, Router } from 'express';

function handleRequest(req: Request, res: Response) {
    // express puts content after first slash into 0 index element

    const path = req.params.path + req.params[0];

    const attributeIds = sql.getColumn<string>("SELECT attributeId FROM attributes WHERE isDeleted = 0 AND type = 'label' AND name IN ('customRequestHandler', 'customResourceProvider')");

    const attrs = attributeIds.map(attrId => becca.getAttribute(attrId));

    for (const attr of attrs) {
        if (!attr?.value.trim()) {
            continue;
        }

        const regex = new RegExp(`^${attr.value}$`);
        let match;

        try {
            match = path.match(regex);
        }
        catch (e: any) {
            log.error(`Testing path for label '${attr.attributeId}', regex '${attr.value}' failed with error: ${e.message}, stack: ${e.stack}`);
            continue;
        }

        if (!match) {
            continue;
        }

        if (attr.name === 'customRequestHandler') {
            const note = attr.getNote();

            log.info(`Handling custom request '${path}' with note '${note.noteId}'`);

            try {
                scriptService.executeNote(note, {
                    pathParams: match.slice(1),
                    req,
                    res
                });
            }
            catch (e: any) {
                log.error(`Custom handler '${note.noteId}' failed with: ${e.message}, ${e.stack}`);

                res.setHeader("Content-Type", "text/plain")
                    .status(500)
                    .send(e.message);
            }
        }
        else if (attr.name === 'customResourceProvider') {
            fileService.downloadNoteInt(attr.noteId, res);
        }
        else {
            throw new Error(`Unrecognized attribute name '${attr.name}'`);
        }

        return; // only the first handler is executed
    }

    const message = `No handler matched for custom '${path}' request.`;

    log.info(message);
    res.setHeader("Content-Type", "text/plain")
        .status(404)
        .send(message);
}

function register(router: Router) {
    // explicitly no CSRF middleware since it's meant to allow integration from external services

    router.all('/custom/:path*', (req: Request, res: Response, next) => {
        cls.namespace.bindEmitter(req);
        cls.namespace.bindEmitter(res);

        cls.init(() => handleRequest(req, res));
    });
}

export = {
    register
};
