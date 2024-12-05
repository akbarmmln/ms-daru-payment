const { workerData, parentPort } = require('worker_threads');
const logger = require('../../config/logger');
const functionScheduler = require('../../function-scheduler/void/index');

logger.info(`Task[${workerData.topic}] Worker[${workerData.id}] start....`);

functionScheduler
  .voidScheduler()
  .then(() => {
    parentPort.postMessage(`Task[${workerData.topic}] Worker[${workerData.id}] finished....`);
  })
  .catch((e) => {
    logger.errorWithContext({ error: e, message: 'functionScheduler voidScheduler describe error' });
    parentPort.postMessage(`Task[${workerData.topic}] Worker[${workerData.id}] error....`);
  });
