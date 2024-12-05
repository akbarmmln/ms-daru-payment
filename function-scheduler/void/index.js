const logger = require('../../config/logger');

exports.voidScheduler = async () => {
  try {
    logger.infoWithContext(`running void scheduler`)
  } catch (e) {
    logger.errorWithContext({ error: e, message: 'error void scheduler' });
  }
};
