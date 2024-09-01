'use strict';

const rsmg = require('../../../response/rs');
const utils = require('../../../utils/utils');
const moment = require('moment');
const uuidv4 = require('uuid').v4;
const logger = require('../../../config/logger');
const formats = require('../../../config/format');
const errMsg = require('../../../error/resError');
const adrVA = require('../../../model/adr_va');
const adrUserTransaction = require('../../../model/adr_user_transaction');
const digit = require('n-digit-token');
const ApiErrorMsg = require('../../../error/apiErrorMsg')
const HttpStatusCode = require("../../../error/httpStatusCode");
const httpCaller = require('../../../config/httpCaller');
const dbconnect = require('../../../config/db').Sequelize;
const { crc16 } = require('crc');
const nanoid = require('nanoid-esm')
const mq = require('../../../config/mq')
const { Op } = require('sequelize');
const lodash = require('lodash');

exports.vaInfo = async function (req, res) {
  try {
    const id = req.id;

    const data = await adrVA.findOne({
      raw: true,
      where: {
        account_id: id
      }
    })
    res.header('access-token', req['access-token']);
    return res.status(200).json(rsmg('000000', data))
  } catch (e) {
    logger.errorWithContext({ error: e, message: 'error GET /api/v1/transaction/va-info...' });
    return utils.returnErrorFunction(res, 'error GET /api/v1/transaction/va-info...', e);
  }
}

exports.createVa = async function (req, res) {
  try {
    const id = req.body.id
    if (formats.isEmpty(id)) {
      throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '70001');
    }
    const data = await adrVA.findOne({
      raw: true,
      where: {
        account_id: id
      }
    })

    if (!data) {
      let newVA;
      while (true) {
        const sequences = moment().format('YYMMDD');
        const fRand = digit.gen(6);
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
        created_by: id,
        modified_dt: null,
        modified_by: null,
        is_deleted: 0,
        va_number: newVA,
        balance: 0,
        account_id: id
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

exports.transferInquiry = async function (req, res) {
  try {
    const account_id = req.id;
    const va_number = req.body.va_number;

    const dataSelft = await adrVA.findOne({
      raw: true,
      where: {
        account_id: account_id
      }
    })
    if (!dataSelft) {
      return res.status(200).json(rsmg('70002', null));
    }

    const data = await adrVA.findOne({
      raw: true,
      where: {
        va_number: va_number
      }
    })

    if (!data) {
      return res.status(200).json(rsmg('70002', null));
    }

    if (dataSelft.va_number === data.va_number) {
      return res.status(200).json(rsmg('70004', null));
    }

    let akun;
    try {
      akun = await httpCaller({
        method: 'POST',
        url: process.env.MS_ACCOUNT_V1_URL + '/account/inquiry',
        data: {
          account_id: data.account_id
        }
      })  
    } catch (e) {
      return res.status(e.response.status).json(e?.response?.data);
    }

    res.header('access-token', req['access-token']);
    return res.status(200).json(rsmg('000000', {
      va_number: data.va_number,
      va_name: akun?.data?.data?.nama
    }))
  } catch (e) {
    logger.errorWithContext({ error: e, message: 'error POST /api/v1/transaction//transfer/inquiry...' });
    return utils.returnErrorFunction(res, 'error POST /api/v1/transaction//transfer/inquiry...', e);
  }
}

exports.transferPayment = async function (req, res) {
  try {
    const transactionDB = await dbconnect.transaction();
    const type = 'tfp';
    const date = moment().format('YYYY-MM-DD HH:mm:ss.SSS')
    const id = uuidv4();
    const jobPartition = parseInt(crc16(id).toString());
    const code_transaction = req.body.code_transaction;
    const partition = formats.getCurrentTimeInJakarta(moment().format(), 'YYYYMM');
    const desiredLength = formats.generateRandomValue(20,30);
    let request_id = nanoid(desiredLength);
    request_id = `${request_id}-${partition}`;

    const va_number_source = req.body.va_number_source;
    const va_number_destination = req.body.va_number_destination;
    const va_name_source = req.body.va_name_source;
    const va_name_destination = req.body.va_name_destination;
    let nominal = req.body.nominal;
    nominal = nominal.replace(/\./g, '');
    const pesan = req.body.pesan;

    try {
      await httpCaller({
        method: 'POST',
        url: process.env.MS_AUTH_V1_URL + '/auth/verify-code-trx',
        data: {
          type: type,
          code: code_transaction
        }
      })  
    } catch (e) {
      return res.status(e.response.status).json(e?.response?.data);
    }

    const state = {
      type: type,
      tracking: [
        {
          title: 'Poin ditarik dari sumber dana poin kamu',
          status: '2'
        },
        {
          title: 'Respon dari va penerima',
          status: '2'
        },
        {
          title: 'Berhasil transfer poin ke penerima',
          status: '2'
        }
      ]
    }
    const payload = {
      va_number_source,
      va_number_destination,
      va_name_source,
      va_name_destination,
      nominal,
      pesan
    }

    const tabelUserTransaction = adrUserTransaction(partition)
    await tabelUserTransaction.create({
      id: id,
      created_dt: date,
      created_by: req.id,
      modified_dt: date,
      modified_by: req.id,
      is_deleted: 0,
      request_id: request_id,
      account_id: req.id,
      amount: nominal,
      transaction_type: type,
      state: JSON.stringify(state),
      payload: JSON.stringify(payload),
      status: 2,
      partition: jobPartition % parseInt(8),
    }, {
      transaction: transactionDB
    })

    let ress = await mq.sendTOMQ('transfer_poin', {
      request_id: request_id,
      ...payload,
      state
    });
    if (ress.status == 200) {
      await transactionDB.commit();
    } else {
      await transactionDB.rollback();
      throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '10000');
    }

    const hasil = {
      request_id: request_id,
      nominal: nominal,
      va_number_destination: va_number_destination,
      va_name_destination: va_name_destination,
      type: type,
      waktu: formats.getCurrentTimeInJakarta(moment(date).format(), 'HH:mm'),
      tanggal: formats.getCurrentTimeInJakarta(moment(date).format(), 'DD MM YYYY'),
      state: state,
      payload: payload,
      status: '2'
    }
    res.header('access-token', req['access-token']);
    return res.status(200).json(rsmg('000000', hasil))
  } catch (e) {
    logger.errorWithContext({ error: e, message: 'error POST /api/v1/transaction//transfer/payment...' });
    return utils.returnErrorFunction(res, 'error POST /api/v1/transaction//transfer/payment...', e);
  }
}

exports.transactionDetails = async function(req, res){
  try{
    let hasil;
    const id = req.params.id;
    const splitId = id.split('-');
    const splitIdLenght = splitId.length
    const partition = splitId[splitIdLenght - 1]

    const tabelUserTransaction = adrUserTransaction(partition)
    const data = await tabelUserTransaction.findOne({
      raw: true,
      where: {
        request_id: id
      }
    })

    if (!data) {
      throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '70003');
    }

    if (data && data.transaction_type === 'tfp') {
      const payload = JSON.parse(data.payload);
      const va_number_destination = payload.va_number_destination;
      const va_name_destination = payload.va_name_destination
      const date = formats.getCurrentTimeInJakarta(data.created_dt, 'YYYY-MM-DD HH:mm:ss.SSS')
      hasil = {
        request_id: data.request_id,
        nominal: data.amount,
        va_number_destination: va_number_destination,
        va_name_destination: va_name_destination,
        type: data.transaction_type,
        waktu: moment(date).format('HH:mm'),
        tanggal: moment(date).format('DD MM YYYY'),
        state: JSON.parse(data.state),
        payload: JSON.parse(data.payload),
        status: data.status.toString()
      }
    }
    res.header('access-token', req['access-token']);
    return res.status(200).json(rsmg('000000', hasil));
  }catch(e){
    logger.errorWithContext({ error: e, message: 'error GET /api/v1/transaction/details/:id...' });
    return utils.returnErrorFunction(res, 'error GET /api/v1/transaction/details/:id...', e);
  }
}

exports.transactionHistory = async function (req, res) {
  try {
    function getDatesBetween(startDate, endDate) {
      let dates = [];
      let currentDate = new Date(startDate);

      while (currentDate <= new Date(endDate)) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return dates;
    }

    let hasil = [];
    const id = req.id;
    const date_start = req.body.date_start;
    const date_end = req.body.date_end;
    const datesArray = getDatesBetween(date_start, date_end);
    if (datesArray.length > 60) {
      throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '70008');
    }

    const groupedDates = datesArray.reduce((acc, date) => {
      const anDate = formats.getCurrentTimeInJakarta(date, 'YYYY-MM-DD')
      const yearMonth = formats.getCurrentTimeInJakarta(anDate, 'YYYYMM')
      let group = acc.find(g => g.group === yearMonth);
      if (!group) {
        group = { group: yearMonth, data: [] };
        acc.push(group);
      }
      group.data.push(anDate);
      return acc;
    }, []);

    for (let k=0; k<groupedDates.length; k++) {
      const group = groupedDates[k].group;
      const tanggal = groupedDates[k].data;
      let where;
      if (tanggal.length > 1) {
        where = dbconnect.literal(`account_id = '${id}' and date(created_dt) between '${formats.getCurrentTimeInJakarta(tanggal[0], 'YYYY-MM-DD')}' and '${formats.getCurrentTimeInJakarta(tanggal[tanggal.length - 1], 'YYYY-MM-DD')}'`)
      } else {
        where = dbconnect.literal(`account_id = '${id}' and date(created_dt) between '${formats.getCurrentTimeInJakarta(tanggal[0], 'YYYY-MM-DD')}' and '${formats.getCurrentTimeInJakarta(tanggal[0], 'YYYY-MM-DD')}'`)
      }
      const tabelUserTransaction = adrUserTransaction(group);
      const data = await tabelUserTransaction.findAll({
        raw: true,
        where: where
      })

      const modifiedData = data.map(item => {
        item.created_dt = formats.getCurrentTimeInJakarta(item.created_dt, 'YYYY-MM-DD HH:mm:ss.SSS');
        item.modified_dt = formats.getCurrentTimeInJakarta(item.modified_dt, 'YYYY-MM-DD HH:mm:ss.SSS');
        return item;
      });

      hasil.push(...sortedData)
    }

    if (hasil.length > 0) {
      const hasilModified = lodash.orderBy(hasil, ['created_dt'], ['desc']);
      const groupHasil = hasilModified.reduce((acc, currentItem) => {
        const group = formats.convertToLiteralDate(moment(currentItem.created_dt).format('YYYY-MM-DD'));

        if (!acc[group]) {
          acc[group] = { group, data: [] };
        }

        acc[group].data.push(currentItem);
        return acc;
      }, {});
      const result = Object.values(groupHasil);
      res.header('access-token', req['access-token']);
      return res.status(200).json(rsmg('000000', result));  
    } else {
      res.header('access-token', req['access-token']);
      return res.status(200).json(rsmg('000000', []));  
    }
  } catch (e) {
    logger.errorWithContext({ error: e, message: 'error GET /api/v1/transaction/history...' });
    return utils.returnErrorFunction(res, 'error GET /api/v1/transaction/history...', e);
  }
}