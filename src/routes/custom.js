const repository = require('../services/repository');
const log = require('../services/log');
const scriptService = require('../services/script');

function register(router) {
    router.all('/custom/:path*', async (req, res, next) => {
        const attrs = await repository.getEntities("SELECT * FROM attributes WHERE isDeleted = 0 AND type = 'label' AND ('customRequestHandler', 'customResourceProvider')");

        for (const attr of attrs) {
            const regex = new RegExp(attr.value);

            try {
                const m = regex.match(router.path);

                if (m) {
                    if (attr.name === 'customRequestHandler') {
                        const note = await attr.getNote();

                        await scriptService.executeNote(note, {
                            pathParams: m.slice(1),
                            req,
                            res
                        });
                    }
                    else if (attr.name === 'customResourceProvider') {

                    }

                    break;
                }
            }
            catch (e) {
                log.error(`Testing path for label ${attr.attributeId}, regex=${attr.value} failed with error ` + e.stack);
            }
        }

        res.send('Hello ' + req.params.path);
    });
}

module.exports = {
    register
};