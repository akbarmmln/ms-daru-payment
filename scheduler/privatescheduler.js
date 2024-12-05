const { Worker } = require('worker_threads');
const { ToadScheduler, SimpleIntervalJob, Task } = require('toad-scheduler');
const Assignor = require('../config/assignor');
const logger = require('../config/logger');

class PrivateScheduler {
    #assignor;

    async initialize() {
        this.#assignor = new Assignor();
    }

    async startVoid() {
        const topic = 'Scheduler.startVoid'
        const maxPartition = parseInt(8);
        const workerCount = parseInt(1);
        logger.infoWithContext(`Scheduler ${topic} will be check for cluster ${process.env.CLUSTER}`);

        if (process.env.KUBE_CLIENT_SCHEDULE == 'true') {
            logger.infoWithContext(`Scheduler ${topic} running in cluster ${process.env.CLUSTER}`);

            await this.initialize();
            const partitions = await this.#assignor.getAssignedPartition(topic, maxPartition);
            const scheduler = new ToadScheduler();
            logger.infoWithContext(`Initialize Scheduler[${topic}] at machine [${this.#assignor.getIdentifier()}]`);

            if (partitions.length > 0) {
                const task = new Task(topic, () => {
                    const startVoidWorker = [];
                    this.#assignor.getAssignedPartition(topic, maxPartition).then((partitionsList) => {
                        const assignedPartitions = [];
                        for (let i = 0; i < partitionsList.length; i++) {
                            if (!assignedPartitions[i % workerCount]) {
                                assignedPartitions[i % workerCount] = [];
                                assignedPartitions[i % workerCount].push(partitionsList[i]);
                            } else {
                                assignedPartitions[i % workerCount].push(partitionsList[i]);
                            }
                        }
                        for (let i = 0; i < workerCount; i++) {
                            startVoidWorker.push(
                                new Worker('./scheduler/void/index.js', {
                                    workerData: {
                                        topic,
                                        maxPartition,
                                        id: i,
                                        partitions: assignedPartitions[i],
                                    },
                                })
                            );
                        }
                        for (let i = 0; i < workerCount; i++) {
                            startVoidWorker[i].once("message", result => {
                                logger.infoWithContext(`${topic} (on meesage) Payload Result ${JSON.stringify(result)}`);
                                startVoidWorker[i].terminate();
                            });
                            startVoidWorker[i].once("error", result => {
                                logger.infoWithContext(`${topic} (on error) Payload Result ${JSON.stringify(result)}`);
                                startVoidWorker[i].terminate();
                            });
                            startVoidWorker[i].once("exit", result => {
                                logger.infoWithContext(`${topic} (on exit) Payload Result ${JSON.stringify(result)}`);
                                startVoidWorker[i].terminate();
                            });
                        }
                    });
                });

                const job = new SimpleIntervalJob(
                    {
                        milliseconds: parseInt(60123),
                        runImmediately: true,
                    },
                    task
                );
                scheduler.addSimpleIntervalJob(job);
            }
        } else {
            logger.info(`Scheduler ${topic} not running in cluster ${process.env.CLUSTER}`);
        }
    }
}

module.exports = PrivateScheduler;