const express = require('express');
const router = express.Router();
const controller = require('./controller');
const utils = require('../../../utils/utils');

router.post('/create-va', controller.createVa);

router.get('/va-info', utils.verifyTokenMs, controller.vaInfo);
router.post('/transfer/inquiry', utils.verifyTokenMs, controller.transferInquiry);
router.post('/transfer/payment', utils.verifyTokenMs, controller.transferPayment);

router.get('/details/:id', utils.verifyTokenMs, controller.transactionDetails);

module.exports = router;