const logger = require('./config/logger');
const mq = require('./config/mq');

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
    }, {
        noAck: true
    });
}
