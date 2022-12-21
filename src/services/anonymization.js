const BUILTIN_ATTRIBUTES = require("./builtin_attributes");
const fs = require("fs-extra");
const dataDir = require("./data_dir");
const dateUtils = require("./date_utils");
const Database = require("better-sqlite3");
const sql = require("./sql");

function getFullAnonymizationScript() {
    // we want to delete all non-builtin attributes because they can contain sensitive names and values
// on the other hand builtin/system attrs should not contain any sensitive info
    const builtinAttrNames = BUILTIN_ATTRIBUTES
        .map(attr => `'${attr.name}'`).join(', ');

    const anonymizeScript = `
UPDATE etapi_tokens SET tokenHash = 'API token hash value';
UPDATE notes SET title = 'title' WHERE title NOT IN ('root', '_hidden', '_share');
UPDATE note_contents SET content = 'text' WHERE content IS NOT NULL;
UPDATE note_revisions SET title = 'title';
UPDATE note_revision_contents SET content = 'text' WHERE content IS NOT NULL;

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
    return `
         UPDATE note_contents SET content = 'text' WHERE content IS NOT NULL AND noteId NOT IN (
                SELECT noteId FROM notes WHERE mime IN ('application/javascript;env=backend', 'application/javascript;env=frontend')
         );
         UPDATE note_revision_contents SET content = 'text' WHERE content IS NOT NULL AND noteRevisionId NOT IN (
                SELECT noteRevisionId FROM note_revisions WHERE mime IN ('application/javascript;env=backend', 'application/javascript;env=frontend')
         );
     `;
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

module.exports = {
    getFullAnonymizationScript,
    createAnonymizedCopy
}
