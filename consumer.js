const logger = require('./config/logger');
const mq = require('./config/mq');
const dbconnect = require('./config/db').Sequelize;
const sequelize = require('sequelize');
const adrVA = require('./model/adr_va');
const adrUserTransaction = require('./model/adr_user_transaction');

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

        try {
            const request_id = payload.request_id;
            const nominal = payload.nominal;
            let tracking = payload.tracking;
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
                tracking[0].status = "0";
                tracking[1].status = "0";
                tracking[2].status = "0";
                await updateUserTransaction({
                    state: tracking,
                    status: 0
                }, request_id);
                throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '70003');
            }
            
            //start deduct va number source
            const data_va_number_source = await dbconnect.query("SELECT * FROM adr_va WHERE va_number = :va_number_ FOR UPDATE",
            { replacements: { va_number_: va_number_source }, type: sequelize.QueryTypes.SELECT, transaction: transactionDB },
            {
              raw: true
            });

            if (data_va_number_source.length <= 0) {
                tracking[0].status = "0";
                await updateUserTransaction({
                    state: tracking,
                    status: 0
                }, request_id);
                throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '70002');
            }
        
            if (parseInt(nominal) > parseInt(data_va_number_source[0]['balance'])) {
                tracking[0].status = "0";
                await updateUserTransaction({
                    state: tracking,
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
                    tracking[0].status = "1";
                    await updateUserTransaction({
                        state: tracking,
                    }, request_id);    
                } catch (e) {
                    tracking[0].status = "0";
                    await updateUserTransaction({
                        state: tracking,
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
                tracking[0].status = "0";
                tracking[1].status = "0";
                await updateUserTransaction({
                    state: tracking,
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
                tracking[1].status = "1";
                await updateUserTransaction({
                    state: tracking,
                }, request_id);
            } catch (e) {
                tracking[0].status = "0";
                tracking[1].status = "0";
                await updateUserTransaction({
                    state: tracking,
                    status: 0
                }, request_id);
                throw new ApiErrorMsg(HttpStatusCode.BAD_REQUEST, '70007');
            }
            //end add va number destination

            tracking[2].status = "1";
            await updateUserTransaction({
                state: tracking,
                status: 1
            }, request_id);
            await transactionDB.commit();
        } catch (e) {
            await transactionDB.rollback();
        }
    }, {
        noAck: true
    });
}

const updateUserTransaction = async function (payload, request_id) {
    await adrUserTransaction.update(payload, {
        where: {
            request_id: request_id
        }
    })
}