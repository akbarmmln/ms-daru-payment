const mqName = {
    transfer_poin: `transferPoin`,
    payment_notif_ipl: `paymentNotifIPL`,
}
const amqp = require('amqplib');
const logger = require('./logger');
const settings = require('../setting');
const connectObject = settings.mq;

exports.createMqConnection = async function () {
    try {
        const connection = await amqp.connect(connectObject);
        const channel = await connection.createChannel();

        return {
            connection: connection,
            channel: channel
        }
    } catch (e) {
        logger.error({message: 'Unable to connect to MQ', error: e});
        throw e;
    }
}

exports.getQueueName = async (name = null) => {
    return mqName[name];
}

exports.sendTOMQ = async function (name, data) {
    try {
        let mqConnectionObject, queueName, connection, channel, tomq;
        tomq = data;
        mqConnectionObject = await exports.createMqConnection();
        queueName = await exports.getQueueName(name);
        connection = mqConnectionObject.connection;
        channel = mqConnectionObject.channel;
        channel.assertQueue(queueName, {
            arguments: { 'x-queue-type': 'classic' },
            durable: true,
        });
        if (typeof tomq === 'object') {
            tomq = JSON.stringify(tomq);
        }
        channel.sendToQueue(queueName, Buffer.from(tomq));
        setTimeout(function () {
            connection.close();
        }, 500);
        return {
            status: 200
        }
    } catch (e) {
        return {
            status: 400
        }
    }
}