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
const adrUserTransaction = require('../../../model/adr_user_transaction');
const { crc16 } = require('crc');

exports.initIPL = async function (req, res) {
  try {
    const id = req.id;
    const tahun_implementasi = req.body.tahun_implementasi;
    let iplPending, detailsPending;

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

    const tabelInvoicing = paymentInvoicing(tahun_implementasi);
    const tabelBayarIPL = adrPembayaranIPL(tahun_implementasi);

    const pending = await tabelInvoicing.findOne({
      raw: true,
      where: {
        is_deleted: 0,
        account_id: id,
        transaction_status: 'pending'
      }
    })
    if (pending) {
      const user_transaction_id = pending.user_transaction_id;
      const splitId = user_transaction_id.split('-');
      const splitIdLenght = splitId.length;
      const partition = splitId[splitIdLenght - 1];

      const tabelUserTransaction = adrUserTransaction(partition)
      const data = await tabelUserTransaction.findOne({
        raw: true,
        where: {
          request_id: user_transaction_id
        }
      })
      iplPending = pending;
      detailsPending = data;
      iplPending.expiry_time = moment(iplPending.expiry_time).format('YYYY-MM-DD HH:mm:ss')
    }

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
      dataIPL: data,
      iplPending: pending,
      detailsPending: detailsPending
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
    const fullDate = moment().format('YYYY-MM-DD HH:mm:ss.SSS')
    const partitionIPL = moment(fullDate).format('YYYY')
    const desiredLength = formats.generateRandomValue(10,15);
    const order_id = nanoid(desiredLength);
    const order_id_ipl = `${order_id}-${partitionIPL}`;
    const partitionUsrTrx = moment().format('YYYYMM');
    const order_id_usr_trx = `${order_id}-${partitionUsrTrx}`;

    const type = 'ipl'
    const code_trx = req.body.code_trx;
    const bank = req.body.bank;
    const net_amount = req.body.net_amount;
    const gross_amount = req.body.gross_amount;
    const details= req.body.details;

    try {
      await httpCaller({
        method: 'POST',
        url: process.env.MS_AUTH_V1_URL + '/auth/verify-code-trx',
        data: {
          type: 'bayar-ipl',
          code: code_trx
        }
      })  
    } catch (e) {
      return res.status(e.response.status).json(e?.response?.data);
    }

    payloadRequest = {
      transaction_details: {
        order_id: order_id_ipl,
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
      const tabelInvoicing = paymentInvoicing(partitionIPL);
      let paymentInvoicingTable = {
        id: uuidv4(),
        created_dt: moment().format('YYYY-MM-DD HH:mm:ss'),
        created_by: req.id,
        modified_dt: moment().format('YYYY-MM-DD HH:mm:ss'),
        modified_by: req.id,
        is_deleted: 0,
        order_id: order_id_ipl,
        account_id: req.id,
        transaction_id: ressInvoice.data.transaction_id,
        merchant_id: ressInvoice.data.merchant_id,
        transaction_time: ressInvoice.data.transaction_time,
        expiry_time: ressInvoice.data.expiry_time,
        transaction_status: ressInvoice.data.transaction_status,
        gross_amount: ressInvoice.data.gross_amount,
        net_amount: net_amount,
        currency: ressInvoice.data.currency,
        transaction_type: ressInvoice.data.payment_type,
        user_transaction_id: order_id_usr_trx
      }
  
      if (ressInvoice.data.payment_type === 'bank_transfer') {
        paymentInvoicingTable.va_numbers = ressInvoice.data.va_numbers[0].va_number
        paymentInvoicingTable.store = ressInvoice.data.va_numbers[0].bank
      } else if (ressInvoice.data.payment_type === 'echannel') {
        paymentInvoicingTable.va_numbers = ressInvoice.data.bill_key
        paymentInvoicingTable.store = 'mandiri'
      }
      await tabelInvoicing.create(paymentInvoicingTable);

      await saveUsertTransaction(order_id_usr_trx, req.id, net_amount, gross_amount, order_id_ipl, details, type, 'bank_transfer');

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

    const user_transaction_id = data.user_transaction_id;
    const splitIdTrx = user_transaction_id.split('-');
    const splitIdTrxLenght = splitIdTrx.length
    const partitionTrx = splitIdTrx[splitIdTrxLenght - 1]
    const tabelUserTransaction = adrUserTransaction(partitionTrx)

    const dataTrx = await tabelUserTransaction.findOne({
      raw: true,
      where: {
        request_id: user_transaction_id
      }
    })
    if (!dataTrx) {
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

    await tabelInvoicing.update({
      transaction_status: 'cancel'
    }, {
      where: {
        order_id: order_id
      }
    })

    await tabelUserTransaction.update({
      status: 3
    }, {
      where: {
        request_id: user_transaction_id
      }
    })

    return res.status(200).json(rsmg('000000'))
  } catch (e) {
    logger.errorWithContext({ error: e, message: 'error POST /api/v1/ipl/cancel...' });
    return utils.returnErrorFunction(res, 'error POST /api/v1/ipl/cancel...', e);
  }
}

const saveUsertTransaction = async function (order_id_usr_trx, account_id, net_amount, gross_amount, order_id_ipl, details, type, payment_method) {
  try {
    const jobPartition = parseInt(crc16(uuidv4()).toString());
    const splitId = order_id_usr_trx.split('-');
    const splitIdLenght = splitId.length
    const partition = splitId[splitIdLenght - 1]

    const tabelUserTransaction = adrUserTransaction(partition)
    const payloadUserTransaction = {
      net_amount: net_amount,
      gross_amount: gross_amount,
      order_id: order_id_ipl,
      details: details
    }
    let state = null;
    if (payment_method === 'bank_transfer') {
      state = {
        type: type,
        tracking: [
          {
            title: 'Nomor VA dibuat',
            status: '1'
          },
          {
            title: 'Respon dari bank penerima',
            status: '2'
          },
          {
            title: 'Uang berhasil dikirim ke layanan',
            status: '2'
          }
        ]
      }
    }
    
    await tabelUserTransaction.create({
      id: uuidv4(),
      created_dt: moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
      created_by: account_id,
      modified_dt: moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
      modified_by: account_id,
      is_deleted: 0,
      request_id: order_id_usr_trx,
      account_id: account_id,
      amount: gross_amount,
      transaction_type: type,
      state: JSON.stringify(state),
      payload: JSON.stringify(payloadUserTransaction),
      status: 2,
      partition: jobPartition % parseInt(8),
    })
  } catch (e) {
    logger.errorWithContext({ error: e, message: 'error to do save user transaction' })
    throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '10000');
  }
}

exports.detailInvoice = async function(req, res) {
  try{
    const order_id = req.params.orderid;
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

    const user_transaction_id = data.user_transaction_id;
    const splitIdTrx = user_transaction_id.split('-');
    const splitIdTrxLenght = splitIdTrx.length
    const partitionTrx = splitIdTrx[splitIdTrxLenght - 1]
    const tabelUserTransaction = adrUserTransaction(partitionTrx)

    const dataTrx = await tabelUserTransaction.findOne({
      raw: true,
      where: {
        request_id: user_transaction_id
      }
    })
    if (!dataTrx) {
      throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '70003');
    }

    const usr = process.env.MIDTRANS_USR;
    const pass = process.env.MIDTRANS_PASS;
    const base64Credentials = btoa(`${usr}:${pass}`);

    const fullPayloadRequest = {
      method: 'GET',
      url: process.env.MIDTRANS_URL + `/${order_id}/status`,
      headers: {
        authorization: `Basic ${base64Credentials}`
      }
    }
    logger.infoWithContext(`fullPayloadRequest ${JSON.stringify(fullPayloadRequest)}`)
    const ressInvoice = await httpCaller(fullPayloadRequest)
    logger.infoWithContext(`fullResponRequest ${JSON.stringify(ressInvoice.data)}`)

    const order_id_respon = ressInvoice.data?.order_id;
    if (order_id) {
      let statenow;
      if (ressInvoice.data?.transaction_status == 'expire') {
        statenow = 4
      } else if (ressInvoice.data?.transaction_status == 'cancel') {
        statenow = 3
      }

      if (dataTrx.status != statenow) {
        await tabelInvoicing.update({
          transaction_status: ressInvoice.data?.transaction_status
        }, {
          where: {
            order_id: order_id_respon
          }
        })

        await tabelUserTransaction.update({
          status: statenow
        }, {
          where: {
            request_id: user_transaction_id
          }
        })
      }
    }

    res.header('access-token', req['access-token']);
    return res.status(200).json(rsmg('000000'))
  }catch(e){
    logger.errorWithContext({ error: e, message: 'error GET /api/v1/ipl/detail/invoice/:orderid...' });
    return utils.returnErrorFunction(res, 'error GET /api/v1/ipl/detail/invoice/:orderid...', e);
  }
}