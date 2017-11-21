"use strict";

const express = require('express');
const router = express.Router();
const app_info = require('../../services/app_info');

router.get('', async (req, res, next) => {
    res.send(app_info);
});

module.exports = router;