module.exports = {
    mysql: {
        hostname: process.env.MYSQL_HOSTNAME,
        username: process.env.MYSQL_USERNAME,
        password: process.env.MYSQL_PASSWORD,
        port: process.env.MYSQL_PORT,
        dbname: process.env.MYSQL_DATABASE,
    },
    oss: {
        credentials: {
            accessKeyId: process.env.ACC_KEY_ID,
            secretAccessKey: process.env.SCR_ACC_KEY
        },
        region: process.env.OSS_REGION,
        endpoint: process.env.OSS_ENDPOINT
    },
    email: {
        hostname: process.env.HOST_MAIL,
        username: process.env.USER_MAIL,
        password: process.env.PASS_MAIL,
        port: process.env.PORT_MAIL
    },
    secret: process.env.SECRET,
    mq: {
        protocol: 'amqp',
        hostname: process.env.MQ_HOSTNAME,
        port: 5672,
        username: process.env.MQ_USERNAME,
        password: process.env.MQ_PASSWORD,
        vhost: process.env.MQ_VHOST,
    }
};