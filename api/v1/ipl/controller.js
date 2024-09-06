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
const paymentInvoicing = require('../../../model/adr_payment_invoicing');
const nanoid = require('nanoid-esm')

exports.initIPL = async function (req, res) {
  try {
    const id = req.id;
    const tahun_implementasi = req.body.tahun_implementasi;

    try {
      await httpCaller({
        method: 'POST',
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
        method: 'POST',
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

exports.sendInvoiceBankTransfer = async function (req, res) {
  try {
    let payloadRequest;    
    const partition = formats.getCurrentTimeInJakarta(moment().format(), 'YYYY');
    const desiredLength = formats.generateRandomValue(10,15);
    let order_id = nanoid(desiredLength);
    order_id = `${order_id}-${partition}`;

    const bank = req.body.bank;
    const gross_amount = req.body.gross_amount;
    
    payloadRequest = {
      transaction_details: {
        order_id: order_id,
        gross_amount: gross_amount
      },
      custom_expiry: {
        expiry_duration: 60,
        unit: 'minute'
      }
    }

    if (['01', '03', '04', '05'].includes(bank)) {
      const bankMapping = {
        '01': 'bca',
        '03': 'bni',
        '04': 'bri',
        '05': 'permata'
      };
    
      const bankname = bankMapping[bank];
      payloadRequest.payment_type = 'bank_transfer';
      payloadRequest.bank_transfer = {
        bank: bankname
      };
    } else if (bank === '02') {
      payloadRequest.payment_type = 'echannel';
      payloadRequest.echannel = {
        bill_info1 : "Tagihan IPL",
        bill_info2 : "Tagihan IPL"
      }
    } else {
      throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '70004');
    }

    const usr = process.env.MIDTRANS_USR;
    const pass = process.env.MIDTRANS_PASS;
    const base64Credentials = btoa(`${usr}:${pass}`);
    const fullPayloadRequest = {
      method: 'POST',
      url: process.env.MIDTRANS_URL + '/charge',
      headers: {
        authorization: `Basic ${base64Credentials}`
      },
      data: payloadRequest
    }
    logger.infoWithContext(`fullPayloadRequest ${JSON.stringify(fullPayloadRequest)}`)
    const ressInvoice = await httpCaller(fullPayloadRequest)
    logger.infoWithContext(`fullResponRequest ${JSON.stringify(ressInvoice.data)}`)

    if (['200', '201', '202'].includes(ressInvoice.data.status_code)) {
      const tabelInvoicing = paymentInvoicing(partition);
      let paymentInvoicingTable = {
        id: uuidv4(),
        created_dt: moment().format('YYYY-MM-DD HH:mm:ss'),
        created_by: req.id,
        modified_dt: moment().format('YYYY-MM-DD HH:mm:ss'),
        modified_by: req.id,
        is_deleted: 0,
        order_id: order_id,
        account_id: req.id,
        transaction_id: ressInvoice.data.transaction_id,
        merchant_id: ressInvoice.data.merchant_id,
        transaction_time: ressInvoice.data.transaction_time,
        expiry_time: ressInvoice.data.expiry_time,
        transaction_status: ressInvoice.data.transaction_status,
        gross_amount: ressInvoice.data.gross_amount,
        net_amount: 0,
        currency: ressInvoice.data.currency,
        transaction_type: ressInvoice.data.payment_type
      }
  
      if (ressInvoice.data.payment_type === 'bank_transfer') {
        paymentInvoicingTable.va_numbers = ressInvoice.data.va_numbers[0].va_number
        paymentInvoicingTable.store = ressInvoice.data.va_numbers[0].bank
      } else if (ressInvoice.data.payment_type === 'echannel') {
        paymentInvoicingTable.va_numbers = ressInvoice.data.bill_key
        paymentInvoicingTable.store = 'mandiri'
      }
      await tabelInvoicing.create(paymentInvoicingTable);
      res.header('access-token', req['access-token']);
      return res.status(200).json(rsmg('000000', ressInvoice.data))
    } else {
      throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '70004');
    }
  } catch (e) {
    logger.errorWithContext({ error: e, message: 'error GET /api/v1/ipl/send-invoice/bank-transfer...' });
    return utils.returnErrorFunction(res, 'error POST /api/v1/ipl/send-invoice/bank-transfer...', e);
  }
}

exports.cancelInvoice = async function (req, res) {
  try {
    const order_id = req.body.order_id;
    const splitId = order_id.split('-');
    const splitIdLenght = splitId.length
    const partition = splitId[splitIdLenght - 1]

    const tabelInvoicing = paymentInvoicing(partition);
    const data = await tabelInvoicing.findOne({
      raw: true,
      where: {
        order_id: order_id
      }
    })

    if (!data) {
      throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '70003');
    }

    const usr = process.env.MIDTRANS_USR;
    const pass = process.env.MIDTRANS_PASS;
    const base64Credentials = btoa(`${usr}:${pass}`);
    const fullPayloadRequest = {
      method: 'POST',
      url: process.env.MIDTRANS_URL + `/${data.order_id}/cancel`,
      headers: {
        authorization: `Basic ${base64Credentials}`
      }
    }
    logger.infoWithContext(`fullPayloadRequest ${JSON.stringify(fullPayloadRequest)}`)
    const ressInvoice = await httpCaller(fullPayloadRequest)
    logger.infoWithContext(`fullResponRequest ${JSON.stringify(ressInvoice.data)}`)

    if (['200', '201', '202'].includes(ressInvoice.data.status_code)) {
      await tabelInvoicing.update({
        modified_dt: moment().format('YYYY-MM-DD HH:mm:ss'),
        modified_by: req.id,
        transaction_status: ressInvoice.data.transaction_status
      }, {
        where: {
          id: data.id
        }
      })
    } else {
      throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '70004');
    }
    return res.status(200).json(rsmg('000000'))
  } catch (e) {
    logger.errorWithContext({ error: e, message: 'error POST /api/v1/ipl/cancel...' });
    return utils.returnErrorFunction(res, 'error POST /api/v1/ipl/cancel...', e);
  }
}