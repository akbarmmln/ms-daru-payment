const express = require('express');
const router = express.Router();
const controller = require('./controller');
const utils = require('../../../utils/utils');

router.post('/create-va', controller.createVa);

router.get('/va-info', utils.verifyTokenMs, controller.vaInfo);
router.get('/transfer/inquiry', utils.verifyTokenMs, controller.transferInquiry);

module.exports = router;