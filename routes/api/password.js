const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const changePassword = require('../../services/change_password');
const auth = require('../../services/auth');

router.post('/change', auth.checkApiAuth, async (req, res, next) => {
    const result = await changePassword.changePassword(req.body['current_password'], req.body['new_password']);

    res.send(result);
});

module.exports = router;