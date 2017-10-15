const express = require('express');
const router = express.Router();
const sql = require('../../sql');
const auth = require('../../auth');

router.get('/:full_load_time', auth.checkApiAuth, async (req, res, next) => {
    const fullLoadTime = req.params.full_load_time;

    const browserId = req.get('x-browser-id');

    const count = await sql.getSingleResult("SELECT COUNT(*) AS 'count' FROM audit_log WHERE browser_id != ? " +
        "AND date_modified >= ?", [browserId, fullLoadTime])['count'];

    res.send({
        'changed': count > 0
    });
});

module.exports = router;