/* eslint-disable camelcase */
const pino = require('pino');
const moment = require('moment-timezone');
const uuidGen = require('uuid');
const formats = require('./format');

class LoggerPino {
  #pino = false;

  #context;

  level;

  constructor() {
    this.level = process.env.LOGGER_LEVEL || 'info';
    this.module = process.env.SERVICE_NAME;
    this.#pino = pino({
      level: this.level,
      messageKey: 'log_message',
      timestamp: () => `,"@timestamp":"${formats.getCurrentTimeInJakarta(moment().format())}"`,
      formatters: {
        level(label) {
          return { log_level: label };
        },
        bindings() {
          return {
            business_unit: 'DARUKU',
            programming_language: 'NODEJS',
            log_type: 'AppLog',
          };
        },
      }
    });
  }

  setContext(ctx) {
    this.#context = {
      'x-request-id': ctx,
    };
  }

  getContext() {
    if (!this.#context?.['x-request-id']) {
      const uuid = uuidGen.v4();
      this.setContext(uuid);
    }
    return this.#context['x-request-id'];
  }

  get() {
    return this.#pino;
  }

  // without context
  info(message = null, module, custom_attributes = {}, transaction_id) {
    const childLogger = this.#pino.child({
      request: {},
      module: module || this.module,
      custom_attributes,
      err: {}
    });
    const id = transaction_id?.['x-request-id'] || '';
    const logs = {
      log_message: { message, id }
    }
    childLogger.info(logs);
  }

  debug({ message = null, data = {} }, transaction_id) {
    const childLogger = this.#pino.child({
      request: {},
      module: this.module,
      custom_attributes: { data },
      err: {}
    });
    const id = transaction_id?.['x-request-id'] || '';
    const logs = {
      log_message: { message, id }
    }
    childLogger.debug(logs);
  }

  trace({ message = null, data = {}, event_type = null, module = this.module }, transaction_id = undefined) {
    const childLogger = this.#pino.child({
      event_type,
      log_version: this.#pino.version,
      data,
      request: {},
      module,
      custom_attributes: { data },
    });
    const id = transaction_id?.['x-request-id'] || '';
    childLogger.trace({ message, id });
  }

  warn({ error = {}, message = null, data = {} }, transaction_id) {
    // filter if error from Axios
    if (error?.isAxiosError) {
      // override error response
      // eslint-disable-next-line no-param-reassign
      error = error.toJSON();
    }

    const childLogger = this.#pino.child({
      request: {},
      module: this.module,
      custom_attributes: { data },
    });
    const id = transaction_id?.['x-request-id'] || '';
    childLogger.warn({err: error}, { message, id });
  }

  error({ error = {}, message = null, module = null }, transaction_id) {
    // filter if error from Axios
    if (error?.isAxiosError) {
      // override error response
      // eslint-disable-next-line no-param-reassign
      error = error.toJSON();
    }

    const childLogger = this.#pino.child({
      request: {},
      module: module || this.module,
      custom_attributes: {},
    });
    const id = transaction_id?.['x-request-id'] || '';
    childLogger.error({err: error}, { message, id });
  }

  fatal({ error = {}, message = null, data = {} }, transaction_id = undefined) {
    // filter if error from Axios
    if (error?.isAxiosError) {
      // override error response
      // eslint-disable-next-line no-param-reassign
      error = error.toJSON();
    }

    const childLogger = this.#pino.child({
      request: {},
      module: this.module,
      custom_attributes: { data },
    });

    const id = transaction_id?.['x-request-id'] || '';
    childLogger.fatal({err: error}, { message, id });
  }

  // with context
  infoWithContext(message = null, module, custom_attributes) {
    const transactionId = this.getContext();
    this.info(message, module, custom_attributes, transactionId);
  }

  debugWithContext({ message = null, data = {} }) {
    const transactionId = this.getContext();
    this.debug({ message, data }, transactionId);
  }

  traceWithContext({ message = null, data = {}, event_type = null, module = process.env.SERVICE_NAME }) {
    const transactionId = this.getContext();
    this.trace({ message, data, event_type, module }, transactionId);
  }

  warnWithContext({ error = {}, message = null, data = {} }) {
    const transactionId = this.getContext();
    this.warn({ error, message, data }, transactionId);
  }

  errorWithContext({ error = {}, message = null, module = null }) {
    const transactionId = this.getContext();
    this.error({ error, message, module }, transactionId);
  }

  fatalWithContext({ error = {}, message = null, data = {} }) {
    const transactionId = this.getContext();
    this.fatal({ error, message, data }, transactionId);
  }
}

const logger = new LoggerPino();

module.exports = logger;