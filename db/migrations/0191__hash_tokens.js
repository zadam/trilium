module.exports = () => {
    const sql = require('../../src/services/sql');
    const crypto = require('crypto');

    for (const {etapiTokenId, token} of sql.getRows("SELECT etapiTokenId, tokenHash AS token FROM etapi_tokens")) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('base64');
        
        sql.execute(`UPDATE etapi_tokens SET tokenHash = ? WHERE etapiTokenId = ?`, [tokenHash, etapiTokenId]);
    }
};