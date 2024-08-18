const logger = require('../config/logger');
const errMsg = require('../error/resError');
const axios = require('axios');
const httpCaller = require('../config/httpCaller');

exports.returnErrorFunction = function (resObject, errorMessageLogger, errorObject) {
  if (typeof errorObject === 'string') {
    return resObject.status(400).json(errMsg(errorObject));
  } else if (errorObject.error) {
    return resObject.status(500).json(errorObject.error);
  } else {
    return resObject.status(500).json(errMsg('10000'));
  }
};

exports.verifyTokenMs = async function (req, res, next) {
  try {
    const payload = {
      method: 'POST',
      url: process.env.MS_AUTH_V1_URL + '/auth/verify-token',
      headers: {
        ...req.headers
      }
    }
    const verifyToken = await httpCaller(payload);
    const verifyTokenData = verifyToken?.data
    const verifyTokenHeaders = verifyToken?.headers
    req.id = verifyTokenData.data.id;
    req.parts = verifyTokenData.data.partition;
    req.organitation_id = verifyTokenData.data.organitation_id;
    req.position_id = verifyTokenData.data.position_id;
    req.access_token = verifyTokenHeaders.access_token
    next();
  } catch (e) {
    logger.errorWithContext({ error: e, message: 'error verify token...' });
    return res.status(401).json(e?.response?.data);
  }
}

exports.scramble = function (a) {
  let d;
  a = a.split("");
  for (var b = a.length - 1; 0 < b; b--)
  {
    var c = Math.floor(Math.random() * (b + 1));
    d = a[b]; 
    a[b] = a[c]; 
    a[c] = d
  }
  return a.join("")
}