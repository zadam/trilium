const express = require('express');
const router = express.Router();
const auth = require('../services/auth');

router.get('', auth.checkAuth, (req, res, next) => {
  res.render('index', {});
});

module.exports = router;
