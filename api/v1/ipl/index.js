const express = require('express');
const router = express.Router();
const controller = require('./controller');
const utils = require('../../../utils/utils');

router.post('/init', utils.verifyTokenMs, controller.initIPL);
router.post('/check-tagihan', utils.verifyTokenMs, controller.checkTagihan);

router.post('/send-invoice/bank-transfer', utils.verifyTokenMs, controller.sendInvoiceBankTransfer);

router.post('/send-invoice/qr', utils.verifyTokenMs, controller.sendInvoiceQR);

router.get('/detail/invoice/:orderid', utils.verifyTokenMs, controller.detailInvoice);

router.post('/cancel', utils.verifyTokenMs, controller.cancelInvoice);

router.post('/payment/notif', utils.verifyTokenMs, controller.paymentNotif);

module.exports = router;