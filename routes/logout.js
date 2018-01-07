"use strict";

const express = require('express');
const router = express.Router();
const wrap = require('express-promise-wrap').wrap;

router.post('', wrap(async (req, res, next) => {
    req.session.regenerate(() => {
        req.session.loggedIn = false;

        res.redirect('/');
    });

}));

module.exports = router;
