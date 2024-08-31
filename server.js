'use strict';
require('dotenv').config();
const app = require('./app');
const logger = require('./config/logger');
const consumer = require('./consumer');

// Constants
let PORT = process.env.PORT

const server = app.listen(PORT, () => logger.infoWithContext(`API Server started. Listening on port:${PORT}`));
// mqttConfig.mqtt();
consumer.transferPoin().catch(error => logger.errorWithContext({ error, message: 'Error consume init project' }));

module.exports = server;