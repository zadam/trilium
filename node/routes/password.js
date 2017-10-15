const express = require('express');
const router = express.Router();
const sql = require('../sql');
const changePassword = require('../change_password');

router.post('/change', async (req, res, next) => {
    const result = await changePassword.changePassword(req.body['current_password'], req.body['new_password']);

    res.send(result);
});

module.exports = router;