'use strict';

const rsmg = require('../../../response/rs');
const utils = require('../../../utils/utils');
const moment = require('moment');
const uuidv4 = require('uuid').v4;
const logger = require('../../../config/logger');
const formats = require('../../../config/format');
const errMsg = require('../../../error/resError');
const adrVA = require('../../../model/adr_va');
const ApiErrorMsg = require('../../../error/apiErrorMsg')
const HttpStatusCode = require("../../../error/httpStatusCode");
const httpCaller = require('../../../config/httpCaller');
const adrPembayaranIPL = require('../../../model/adr_pembayaran_ipl');

exports.initIPL = async function (req, res) {
  try {
    const id = req.id;
    const tahun_implementasi = req.body.tahun_implementasi;

    try {
      await httpCaller({
        method: 'GET',
        url: process.env.MS_SUPPORT_V1_URL + '/master-organitation/config',
        data: {
          tahun_implementasi: tahun_implementasi
        }
      })
    } catch (e) {
      return res.status(e.response.status).json(e?.response?.data);
    }

    const tabelBayarIPL = adrPembayaranIPL(tahun_implementasi);

    const data = await tabelBayarIPL.findAll({
      raw: true,
      where: {
        is_deleted: 0,
        account_id: id
      },
      order: [['pembayaran_bulan', 'ASC']]
    })
    const hasil = {
      tahun_implementasi: tahun_implementasi,
      dataIPL: data
    }
    res.header('access-token', req['access-token']);
    return res.status(200).json(rsmg('000000', hasil))
  } catch (e) {
    logger.errorWithContext({ error: e, message: 'error GET /api/v1/ipl/init...' });
    return utils.returnErrorFunction(res, 'error GET /api/v1/ipl/init...', e);
  }
}

exports.checkTagihan = async function (req, res) {
  try {
    const id = req.id;
    const bulan = req.body.bulan;
    const tahun_implementasi = req.body.tahun_implementasi;

    let hasil = [];

    if (!Array.isArray(bulan)) {
      throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '70009');
    }

    let config;
    try {
      config = await httpCaller({
        method: 'GET',
        url: process.env.MS_SUPPORT_V1_URL + '/master-organitation/config',
        data: {
          tahun_implementasi: tahun_implementasi
        }
      })
      config = config?.data?.data;
    } catch (e) {
      return res.status(e.response.status).json(e?.response?.data);
    }

    for (let i = 0; i < bulan.length; i++) {
      let props = {
        bulan: formats.convertToLiteralMonth(bulan[i]),
        details: [],
        total_tagihan: 0
      }
      for (let k = 0; k < config.length; k++) {
        if (config[k].bulan_implementasi == 0 && config[k].status == 1) {
          props.total_tagihan = (parseInt(props.total_tagihan) + parseInt(config[k].tagihan)).toString()
          props.details.push({
            jenis: config[k].jenis_iuran,
            tagihan: parseInt(config[k].tagihan).toString(),
          })
        } else if (config[k].bulan_implementasi != 0 && config[k].status == 1) {
          if (bulan[i] == config[k].bulan_implementasi) {
            props.total_tagihan = (parseInt(props.total_tagihan) + parseInt(config[k].tagihan)).toString()
            props.details.push({
              jenis: config[k].jenis_iuran,
              tagihan: parseInt(config[k].tagihan).toString(),
            })
          }
        }
      }
      hasil.push(props);
    }
    res.header('access-token', req['access-token']);
    return res.status(200).json(rsmg('000000', hasil))
  } catch (e) {
    logger.errorWithContext({ error: e, message: 'error GET /api/v1/ipl/check-tagihan...' });
    return utils.returnErrorFunction(res, 'error GET /api/v1/ipl/check-tagihan...', e);
  }
}