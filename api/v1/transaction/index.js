const express = require('express');
const router = express.Router();
const controller = require('./controller');
const utils = require('../../../utils/utils');

router.get('/create-va', utils.verifyTokenMs, controller.createVa);

router.get('/va-info', utils.verifyTokenMs, controller.vaInfo);

module.exports = router;