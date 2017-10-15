const express = require('express');
const router = express.Router();

router.get('', function(req, res, next) {
  res.render('app', {});
});

module.exports = router;
