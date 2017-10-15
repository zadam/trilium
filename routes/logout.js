const express = require('express');
const router = express.Router();

router.post('', async (req, res, next) => {
    req.session.loggedIn = false;

    res.redirect('login');
});

module.exports = router;
