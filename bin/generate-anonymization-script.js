#!/usr/bin/env node

const BUILTIN_ATTRIBUTES = require('../src/services/builtin_attributes');
const fs = require('fs');
const path = require('path');

// we want to delete all non-builtin attributes because they can contain sensitive names and values
// on the other hand builtin/system attrs should not contain any sensitive info
const builtinAttrNames = BUILTIN_ATTRIBUTES
    .map(attr => "'" + attr.name + "'").join(', ');

const anonymizeScript = `
UPDATE etapi_tokens SET tokenHash = 'API token hash value';
UPDATE notes SET title = 'title';
UPDATE note_contents SET content = 'text' WHERE content IS NOT NULL;
UPDATE note_revisions SET title = 'title';
UPDATE note_revision_contents SET content = 'text' WHERE content IS NOT NULL;

UPDATE attributes SET name = 'name', value = 'value' WHERE type = 'label' AND name NOT IN(${builtinAttrNames});
UPDATE attributes SET name = 'name' WHERE type = 'relation' AND name NOT IN (${builtinAttrNames});
UPDATE branches SET prefix = 'prefix' WHERE prefix IS NOT NULL;
UPDATE options SET value = 'anonymized' WHERE 
                    ('documentId', 'documentSecret', 'encryptedDataKey', 
                     'passwordVerificationHash', 'passwordVerificationSalt', 
                     'passwordDerivedKeySalt', 'username', 'syncServerHost', 'syncProxy') 
                      AND value != '';

VACUUM;
`;

fs.writeFileSync(path.resolve(__dirname, 'anonymize-database.sql'), anonymizeScript);
