'use strict';

const rsmg = require('../../../response/rs');
const utils = require('../../../utils/utils');
const moment = require('moment');
const uuidv4 = require('uuid').v4;
const logger = require('../../../config/logger');
const formats = require('../../../config/format');
const errMsg = require('../../../error/resError');
const adrVA = require('../../../model/adr_va');
const otpGenerator = require('otp-generator');

exports.vaInfo = async function (req, res) {
  try {
    const id = req.id;

    const data = await adrVA.findOne({
      raw: true,
      where: {
        account_id: id
      }
    })

    return res.status(200).json(rsmg('000000', data))
  } catch (e) {
    logger.errorWithContext({ error: e, message: 'error GET /api/v1/transaction/va-info...' });
    return utils.returnErrorFunction(res, 'error GET /api/v1/transaction/va-info...', e);
  }
}

exports.createVa = async function (req, res) {
  try {
    const data = await adrVA.findOne({
      raw: true,
      where: {
        account_id: req.id
      }
    })

    if (!data) {
      let newVA;
      while (true) {
        const sequences = moment().format('YYMMDD');
        const fRand = otpGenerator.generate(6, {
          digits: true,
          alphabets: false,
          upperCase: false,
          specialChars: false,
        });
        const newVAs = `8921${utils.scramble(`${sequences}${fRand}`)}`;
        const checkNewVA = await adrVA.findOne({
          raw: true,
          where: {
            va_number: newVAs
          }
        })
        if (!checkNewVA) {
          newVA = newVAs
          break;
        }
        continue;
      }

      const result = {
        id: uuidv4(),
        created_dt: moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
        created_by: req.id,
        modified_dt: null,
        modified_by: null,
        is_deleted: 0,
        va_number: newVA,
        balance: 0,
        account_id: req.id,
      }
      await adrVA.create(result)
      return res.status(200).json(rsmg('000000', result))
    }
    return res.status(200).json(rsmg('000000', data))
  } catch (e) {
    logger.errorWithContext({ error: e, message: 'error POST /api/v1/transaction/create-va...' });
    return utils.returnErrorFunction(res, 'error POST /api/v1/transaction/create-va...', e);
  }
}