const BUILTIN_ATTRIBUTES = require('./builtin_attributes.js');
const fs = require("fs-extra");
const dataDir = require('./data_dir.js');
const dateUtils = require('./date_utils.js');
const Database = require("better-sqlite3");
const sql = require('./sql.js');
const path = require("path");

function getFullAnonymizationScript() {
    // we want to delete all non-builtin attributes because they can contain sensitive names and values
    // on the other hand builtin/system attrs should not contain any sensitive info
    const builtinAttrNames = BUILTIN_ATTRIBUTES
        .filter(attr => !["shareCredentials", "shareAlias"].includes(attr.name))
        .map(attr => `'${attr.name}'`).join(', ');

    const anonymizeScript = `
UPDATE etapi_tokens SET tokenHash = 'API token hash value';
UPDATE notes SET title = 'title' WHERE title NOT IN ('root', '_hidden', '_share');
UPDATE blobs SET content = 'text' WHERE content IS NOT NULL;
UPDATE revisions SET title = 'title';

UPDATE attributes SET name = 'name', value = 'value' WHERE type = 'label' AND name NOT IN(${builtinAttrNames});
UPDATE attributes SET name = 'name' WHERE type = 'relation' AND name NOT IN (${builtinAttrNames});
UPDATE branches SET prefix = 'prefix' WHERE prefix IS NOT NULL AND prefix != 'recovered';
UPDATE options SET value = 'anonymized' WHERE name IN
                    ('documentId', 'documentSecret', 'encryptedDataKey', 
                     'passwordVerificationHash', 'passwordVerificationSalt', 
                     'passwordDerivedKeySalt', 'username', 'syncServerHost', 'syncProxy') 
                      AND value != '';

VACUUM;
`;

    return anonymizeScript;
}

function getLightAnonymizationScript() {
    return `UPDATE blobs SET content = 'text' WHERE content IS NOT NULL AND blobId NOT IN (
                SELECT blobId FROM notes WHERE mime IN ('application/javascript;env=backend', 'application/javascript;env=frontend')
              UNION ALL
                SELECT blobId FROM revisions WHERE mime IN ('application/javascript;env=backend', 'application/javascript;env=frontend')
            );

            UPDATE options SET value = 'anonymized' WHERE name IN
                  ('documentId', 'documentSecret', 'encryptedDataKey',
                   'passwordVerificationHash', 'passwordVerificationSalt',
                   'passwordDerivedKeySalt', 'username', 'syncServerHost', 'syncProxy')
              AND value != '';`;
}

async function createAnonymizedCopy(type) {
    if (!['full', 'light'].includes(type)) {
        throw new Error(`Unrecognized anonymization type '${type}'`);
    }

    if (!fs.existsSync(dataDir.ANONYMIZED_DB_DIR)) {
        fs.mkdirSync(dataDir.ANONYMIZED_DB_DIR, 0o700);
    }

    const anonymizedFile = `${dataDir.ANONYMIZED_DB_DIR}/anonymized-${type}-${dateUtils.getDateTimeForFile()}.db`;

    await sql.copyDatabase(anonymizedFile);

    const db = new Database(anonymizedFile);

    const anonymizationScript = type === 'light'
        ? getLightAnonymizationScript()
        : getFullAnonymizationScript();

    db.exec(anonymizationScript);

    db.close();

    return {
        success: true,
        anonymizedFilePath: anonymizedFile
    };
}

function getExistingAnonymizedDatabases() {
    if (!fs.existsSync(dataDir.ANONYMIZED_DB_DIR)) {
        return [];
    }

    return fs.readdirSync(dataDir.ANONYMIZED_DB_DIR)
        .filter(fileName => fileName.includes("anonymized"))
        .map(fileName => ({
            fileName: fileName,
            filePath: path.resolve(dataDir.ANONYMIZED_DB_DIR, fileName)
        }));
}

module.exports = {
    getFullAnonymizationScript,
    createAnonymizedCopy,
    getExistingAnonymizedDatabases
}
