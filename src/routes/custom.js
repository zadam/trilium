const repository = require('../services/repository');
const log = require('../services/log');
const fileUploadService = require('./api/file_upload');
const scriptService = require('../services/script');

function register(router) {
    router.all('/custom/:path*', async (req, res, next) => {
        // express puts content after first slash into 0 index element
        const path = req.params.path + req.params[0];

        const attrs = await repository.getEntities("SELECT * FROM attributes WHERE isDeleted = 0 AND type = 'label' AND name IN ('customRequestHandler', 'customResourceProvider')");

        for (const attr of attrs) {
            const regex = new RegExp(attr.value);

            try {
                const m = path.match(regex);

                if (m) {
                    if (attr.name === 'customRequestHandler') {
                        const note = await attr.getNote();

                        log.info(`Handling custom request "${path}" with note ${note.noteId}`);

                        await scriptService.executeNote(note, {
                            pathParams: m.slice(1),
                            req,
                            res
                        });
                    }
                    else if (attr.name === 'customResourceProvider') {
                        await fileUploadService.downloadNoteFile(attr.noteId, res);
                    }

                    return;
                }
            }
            catch (e) {
                log.error(`Testing path for label ${attr.attributeId}, regex=${attr.value} failed with error ` + e.stack);
            }
        }

        const message = `No handler matched for custom ${path} request.`;

        log.info(message);
        res.status(404).send(message);
    });
}

module.exports = {
    register
};