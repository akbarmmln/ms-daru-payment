const moment = require('moment');
const format = require('../config/format');

function resError(code, description, errorDetails = '') {
  return {
    message: 'unsuccessful',
    err_code: code,
    err_msg: !format.isEmpty(description) ? description : 'internal server error',
    err_msg2: errorDetails,
    language: 'EN',
    timestamp: format.getCurrentTimeInJakarta(moment().format(), 'YYYY-MM-DD HH:mm:ss.SSS')
  }
}

module.exports = resError;