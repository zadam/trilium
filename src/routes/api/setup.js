"use strict";

const sqlInit = require('../../services/sql_init');
const sql = require('../../services/sql');
const cls = require('../../services/cls');
const tmp = require('tmp-promise');
const http = require('http');
const fs = require('fs');
const log = require('../../services/log');
const DOCUMENT_PATH = require('../../services/data_dir').DOCUMENT_PATH;
const sourceIdService = require('../../services/source_id');
const url = require('url');

async function setupNewDocument(req) {
    const { username, password } = req.body;

    await sqlInit.createInitialDatabase(username, password);
}

async function setupSyncFromServer(req) {
    const { serverAddress, username, password } = req.body;

    const tempFile = await tmp.file();

    await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(tempFile.path);
        const parsedAddress = url.parse(serverAddress);

        const options = {
            method: 'GET',
            protocol: parsedAddress.protocol,
            host: parsedAddress.hostname,
            port: parsedAddress.port,
            path: '/api/sync/document',
            auth: username + ':' + password
        };

        log.info("Getting document from: " + serverAddress + JSON.stringify(options));

        http.request(options, function(response) {
            response.pipe(file);

            file.on('finish', function() {
                log.info("Document download finished, closing & renaming.");

                file.close(() => { // close() is async, call after close completes.
                    fs.rename(tempFile.path, DOCUMENT_PATH, async () => {
                        cls.reset();

                        await sqlInit.initDbConnection();

                        // we need to generate new source ID for this instance, otherwise it will
                        // match the original server one
                        await sql.transactional(async () => {
                            await sourceIdService.generateSourceId();
                        });

                        resolve();
                    });
                });
            });
        }).on('error', function(err) { // Handle errors
            fs.unlink(tempFile.path); // Delete the file async. (But we don't check the result)

            reject(err.message);
            log.error(err.message);
        }).end();
    });
}

module.exports = {
    setupNewDocument,
    setupSyncFromServer
};