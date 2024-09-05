const express = require('express');
const router = express.Router();
const controller = require('./controller');
const utils = require('../../../utils/utils');

router.post('/init', utils.verifyTokenMs, controller.initIPL);
router.post('/check-tagihan', utils.verifyTokenMs, controller.checkTagihan);

module.exports = router;