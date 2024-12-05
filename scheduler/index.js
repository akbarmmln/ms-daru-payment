const PrivateScheduler = require('./privatescheduler');

class Scheduler {
  constructor() {
    throw new Error('Use Scheduler.getInstance()');
  }

  static getInstance() {
    if (!Scheduler.instance) {
      Scheduler.instance = new PrivateScheduler();
    }
    return Scheduler.instance;
  }
}

module.exports = Scheduler;
