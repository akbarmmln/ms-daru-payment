const logger = require('./config/logger');
const ApiErrorMsg = require('./error/apiErrorMsg')
const HttpStatusCode = require("./error/httpStatusCode");
const mq = require('./config/mq');
const dbconnect = require('./config/db').Sequelize;
const sequelize = require('sequelize');
const adrVA = require('./model/adr_va');
const adrUserTransaction = require('./model/adr_user_transaction');
const moment = require('moment');
const uuidv4 = require('uuid').v4;
const formats = require('./config/format');
const nanoid = require('nanoid-esm')
const adrPembayaranIPL = require('./model/adr_pembayaran_ipl');
const paymentInvoicing = require('./model/adr_payment_invoicing');
const fires = require('./config/firebase').fire;
const db = fires.firestore();

exports.transferPoin = async () => {
  let mqConnectionObject = await mq.createMqConnection();
  let channel = mqConnectionObject.channel;
  let queueName = await mq.getQueueName('transfer_poin');
  await channel.prefetch(1);
  await channel.assertQueue(queueName, {
    arguments: { "x-queue-type": "classic" },
    durable: true
  });

  channel.consume(queueName, async function (msg) {
    // parse message
    let payload = JSON.parse(msg.content.toString());
    logger.infoWithContext(`starting consumer transfer poin ${JSON.stringify(payload)}`);
    const transactionDB = await dbconnect.transaction();
    let globalDataTrx;

    try {
      const request_id = payload.request_id;
      const nominal = payload.nominal;
      let tracking = payload.state;
      const va_number_source = payload.va_number_source;
      const va_number_destination = payload.va_number_destination;

      //find request id of transaction
      const splitId = request_id.split('-');
      const splitIdLenght = splitId.length
      const partition = splitId[splitIdLenght - 1]

      const tabelUserTransaction = adrUserTransaction(partition)
      const dataTrx = await tabelUserTransaction.findOne({
        raw: true,
        where: {
          request_id: request_id
        }
      })
      if (!dataTrx) {
        tracking.tracking[0].status = "0";
        tracking.tracking[1].status = "0";
        tracking.tracking[2].status = "0";
        await updateUserTransaction(tabelUserTransaction, {
          state: JSON.stringify(tracking),
          status: 0
        }, request_id);
        throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '70003');
      }
      globalDataTrx = dataTrx;

      //start deduct va number source
      const data_va_number_source = await dbconnect.query("SELECT * FROM adr_va WHERE va_number = :va_number_ FOR UPDATE",
        { replacements: { va_number_: va_number_source }, type: sequelize.QueryTypes.SELECT, transaction: transactionDB },
        {
          raw: true
        });

      if (data_va_number_source.length <= 0) {
        tracking.tracking[0].status = "0";
        await updateUserTransaction(tabelUserTransaction, {
          state: JSON.stringify(tracking),
          status: 0
        }, request_id);
        throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '70002');
      }

      if (parseInt(nominal) > parseInt(data_va_number_source[0]['balance'])) {
        tracking.tracking[0].status = "0";
        await updateUserTransaction(tabelUserTransaction, {
          state: JSON.stringify(tracking),
          status: 0
        }, request_id);
        throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '70005');
      }

      if (parseInt(nominal) <= parseInt(data_va_number_source[0]['balance'])) {
        try {
          const balance_before = parseInt(data_va_number_source[0]['balance']);
          const balance_after = parseInt(balance_before) - parseInt(nominal);
          await adrVA.update({
            balance: balance_after,
            modified_dt: moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
            modified_by: data_va_number_source[0].account_id
          }, {
            where: {
              va_number: va_number_source
            },
            transaction: transactionDB
          });
          tracking.tracking[0].status = "1";
          await updateUserTransaction(tabelUserTransaction, {
            state: JSON.stringify(tracking),
          }, request_id);
        } catch (e) {
          tracking.tracking[0].status = "0";
          await updateUserTransaction(tabelUserTransaction, {
            state: JSON.stringify(tracking),
            status: 0
          }, request_id);
          throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '70006');
        }
      }

      //start add va number destination
      const data_va_number_destination = await dbconnect.query("SELECT * FROM adr_va WHERE va_number = :va_number_ FOR UPDATE",
        { replacements: { va_number_: va_number_destination }, type: sequelize.QueryTypes.SELECT, transaction: transactionDB },
        {
          raw: true
        });

      if (data_va_number_destination.length <= 0) {
        tracking.tracking[0].status = "1";
        tracking.tracking[1].status = "0";
        await updateUserTransaction(tabelUserTransaction, {
          state: JSON.stringify(tracking),
          status: 0
        }, request_id);
        throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '70002');
      }

      try {
        const balance_before = parseInt(data_va_number_destination[0]['balance']);
        const balance_after = parseInt(balance_before) + parseInt(nominal);

        await adrVA.update({
          balance: balance_after,
          modified_dt: moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
          modified_by: null
        }, {
          where: {
            va_number: va_number_destination
          },
          transaction: transactionDB
        });
        tracking.tracking[1].status = "1";
        await updateUserTransaction(tabelUserTransaction, {
          state: JSON.stringify(tracking),
        }, request_id);

        const destinationPartition = formats.getCurrentTimeInJakarta(moment().format(), 'YYYYMM');
        const tabelUserTransactionDesc = adrUserTransaction(destinationPartition);
        const desiredLength = formats.generateRandomValue(20, 30);
        let request_id_destination = nanoid(desiredLength);
        request_id_destination = `${request_id_destination}-${destinationPartition}`;

        await tabelUserTransactionDesc.create({
          id: uuidv4(),
          created_dt: moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
          created_by: data_va_number_destination[0].account_id,
          modified_dt: moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
          modified_by: data_va_number_destination[0].account_id,
          is_deleted: 0,
          request_id: request_id_destination,
          account_id: data_va_number_destination[0].account_id,
          amount: nominal,
          transaction_type: 'cash-in',
          state: null,
          payload: JSON.stringify({
            va_number_source: payload.va_number_source,
            va_name_source: payload.va_name_source,
            va_number_destination: payload.va_number_destination,
            va_name_destination: payload.va_name_destination,
            pesan: payload.pesan
          }),
          status: 1,
          partition: null
        }, {
          transaction: transactionDB
        })
      } catch (e) {
        tracking.tracking[0].status = "0";
        tracking.tracking[1].status = "0";
        await updateUserTransaction(tabelUserTransaction, {
          state: JSON.stringify(tracking),
          status: 0
        }, request_id);
        throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '70007');
      }
      //end add va number destination

      tracking.tracking[2].status = "1";
      await updateUserTransaction(tabelUserTransaction, {
        state: JSON.stringify(tracking),
        status: 1
      }, request_id);
      await transactionDB.commit();
    } catch (e) {
      await transactionDB.rollback();
      doReversal(globalDataTrx);
    }
  }, {
    noAck: true
  });
}

const doReversal = async function (dataTransaction) {
  try {
    const partition = formats.getCurrentTimeInJakarta(moment().format(), 'YYYYMM')
    const desiredLength = formats.generateRandomValue(20, 30);
    let request_id = nanoid(desiredLength);
    request_id = `${request_id}-${partition}`;

    const tabelUserTransaction = adrUserTransaction(partition)
    await tabelUserTransaction.create({
      id: uuidv4(),
      created_dt: moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
      created_by: 'SYSTEM-REVERSAL',
      modified_dt: moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
      modified_by: 'SYSTEM-REVERSAL',
      is_deleted: 0,
      request_id: request_id,
      account_id: dataTransaction.account_id,
      amount: dataTransaction.amount,
      transaction_type: 'reversal',
      state: null,
      payload: null,
      status: 1,
      partition: null
    })
  } catch (e) {
    logger.errorWithContext({ error: e, message: 'error do reversal' })
  }
}

const updateUserTransaction = async function (tabelUserTransaction, payload, request_id) {
  await tabelUserTransaction.update(payload, {
    where: {
      request_id: request_id
    }
  })
}

exports.finishingPaymentNotifIPL = async () => {
  let mqConnectionObject = await mq.createMqConnection();
  let channel = mqConnectionObject.channel;
  let queueName = await mq.getQueueName('payment_notif_ipl');
  await channel.prefetch(1);
  await channel.assertQueue(queueName, {
    arguments: { "x-queue-type": "classic" },
    durable: true
  });

  channel.consume(queueName, async function (msg) {
    // parse message
    const payloadMQ = JSON.parse(msg.content.toString());
    logger.infoWithContext(`starting consumer finising payment notif ipl ${JSON.stringify(payload)}`);

    try {
      const order_id = payloadMQ.order_id;
      const splitOrderID = order_id.split('-');
      const splitOrderIDLength = splitOrderID.length;
      const partitionOrderID = splitOrderID[splitOrderIDLength - 1];

      const tabelPemayaranIPL = adrPembayaranIPL(partitionOrderID);
      const tabelInvoicing = paymentInvoicing(partitionOrderID);
      const invoice = await tabelInvoicing.findOne({
        raw: true,
        where: {
          order_id: order_id
        }
      })

      const initiateDataPending = (await db.collection('daru').doc('pending-payment').collection('data').doc(order_id).get()).data();
      console.log('initiateDataPendinginitiateDataPending ', JSON.stringify(initiateDataPending))

      if (invoice) {
        const accountID = invoice.account_id;
        const user_transaction_id = invoice.user_transaction_id;
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

        if (dataTrx) {
          const state = JSON.parse(dataTrx.state);
          const payload = JSON.parse(dataTrx.payload);

          if (['capture', 'settlement'].includes(payloadMQ.transaction_status)) {
            state.tracking[1].status = "1";
            state.tracking[2].status = "1";
          } else if (['deny', 'failure'].includes(payloadMQ.transaction_status)) {
            state.tracking[1].status = "0";
            state.tracking[2].status = "0";
          }

          await tabelInvoicing.update({
            transaction_status: payloadMQ.transaction_status
          }, {
            where: {
              id: invoice.id
            }
          })

          await tabelUserTransaction.update({
            status: 1,
            state: JSON.stringify(state)
          }, {
            where: {
              id: dataTrx.id
            }
          })

          for (let i = 0; i < payload.details.length; i++) {
            try {
              const item = payload.details[i];
              const item_bulan = item.bulan;
              const item_bulanInNumber = formats.convertToIntMonth(item_bulan);
              const item_total_tagihan = item.total_tagihan;

              await tabelPemayaranIPL.create({
                id: uuidv4(),
                created_dt: moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
                created_by: accountID,
                modified_dt: moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
                modified_by: accountID,
                is_deleted: 0,
                account_id: accountID,
                pembayaran_bulan: item_bulanInNumber,
                detail_pembayaran: JSON.stringify(item.details),
                jumlah_tagihan: item_total_tagihan,
                referensi: user_transaction_id
              })
            } catch (e) {
              logger.errorWithContext({ error: e, message: 'error while insert details ipl bayar' });
            }
          }
        }
      }
    } catch (e) {
      logger.errorWithContext({ error: e, message: 'error proccessing finishingPaymentNotifIPL' });
    }
  }, {
    noAck: true
  });
}