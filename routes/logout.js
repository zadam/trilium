"use strict";

const express = require('express');
const router = express.Router();

router.post('', async (req, res, next) => {
    req.session.regenerate(() => {
        req.session.loggedIn = false;

        res.redirect('/');
    });

});

module.exports = router;
