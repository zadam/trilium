const repository = require('../services/repository');
const log = require('../services/log');
const fileUploadService = require('./api/file_upload');
const scriptService = require('../services/script');

function register(router) {
    // explicitly no CSRF middleware since it's meant to allow integration from external services

    router.all('/custom/:path*', async (req, res, next) => {
        // express puts content after first slash into 0 index element
        const path = req.params.path + req.params[0];

        const attrs = await repository.getEntities("SELECT * FROM attributes WHERE isDeleted = 0 AND type = 'label' AND name IN ('customRequestHandler', 'customResourceProvider')");

        for (const attr of attrs) {
            const regex = new RegExp(attr.value);
            let match;

            try {
                match = path.match(regex);
            }
            catch (e) {
                log.error(`Testing path for label ${attr.attributeId}, regex=${attr.value} failed with error ` + e.stack);
                continue;
            }

            if (!match) {
                continue;
            }

            if (attr.name === 'customRequestHandler') {
                const note = await attr.getNote();

                log.info(`Handling custom request "${path}" with note ${note.noteId}`);

                try {
                    await scriptService.executeNote(note, {
                        pathParams: match.slice(1),
                        req,
                        res
                    });
                }
                catch (e) {
                    log.error(`Custom handler ${note.noteId} failed with ${e.message}`);

                    res.status(500).send(e.message);
                }
            }
            else if (attr.name === 'customResourceProvider') {
                await fileUploadService.downloadNoteFile(attr.noteId, res);
            }
            else {
                throw new Error("Unrecognized attribute name " + attr.name);
            }

            return; // only first handler is executed
        }

        const message = `No handler matched for custom ${path} request.`;

        log.info(message);
        res.status(404).send(message);
    });
}

module.exports = {
    register
};