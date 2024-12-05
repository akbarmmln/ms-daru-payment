const logger = require('../config/logger');
const k8s = require('@kubernetes/client-node');

class Assignor {
  constructor() {
    if (Assignor.getInstance) {
      return Assignor.getInstance;
    }

    this.currentPod = process.env.HOSTNAME != undefined ? process.env.HOSTNAME : "";
    try {
      const kubeconfig = new k8s.KubeConfig();
      kubeconfig.loadFromDefault();
      this.client = kubeconfig.makeApiClient(k8s.CoreV1Api);
    } catch (error) {
      if (process.env.ENVIRONMENT !== "development") {
        logger.errorWithContext({ error, message: 'Failed initiated kube client' });
      }
    }

    Assignor.getInstance = this;
  }

  static getInstance = null;

  getIdentifier() {
    return this.currentPod;
  }

  async getAssignedPartition(topic, maxTopicPartition) {
    logger.infoWithContext(`Topic run get partitions ${topic} with max partition ${maxTopicPartition}`);

    if (!this.client) {
      logger.infoWithContext('CLIENT KUBE NOT FOUND');
      let partitions = [];
      for (let i = 0; i < maxTopicPartition; i++) {
        partitions.push(i);
      }
      return partitions;
    } else {
      try {
        //return [0,1,2,3,4,5,6,7];

        //Get all available pods by service name
        const namespace = process.env.NAMESPACE;
        const response = await this.client.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, `app=${process.env.SELECTOR}`);
        logger.infoWithContext(`response available pods in namespace ${namespace} with selector ${process.env.SELECTOR}: ${JSON.stringify(response)}`)

        const pods = response.body.items;
        const currentPod = this.getIdentifier();
        if (currentPod === "") {
          throw new Error("Invalid POD name - Unset");
        }

        //Sort list of pods since we are not sure whether it is sorted
        const names = [];
        const unsortedNames = [];
        for (const item of pods) {
          let readiness = false;
          // Check pod and container readiness
          if (item.metadata.name === currentPod) {
            readiness = true;
          } else if (item.status.phase === 'Running') {
            for (const condition of item.status.conditions) {
              if (condition.type === 'ContainersReady' && condition.status === 'True') {
                readiness = true;
              }
            }
          }

          if (readiness) {
            names.push(item.metadata.name);
          }

          unsortedNames.push(item.metadata.name);
          logger.infoWithContext(`POD Kubernetes ${JSON.stringify(currentPod)}`)
          logger.infoWithContext(`POD Condition ${JSON.stringify(item.status.conditions)}`)
        }

        names.sort();
        logger.infoWithContext(`SORTED POD NAME ${JSON.stringify(names)}`);
        logger.infoWithContext(`UNSORTED POD NAME ${JSON.stringify(unsortedNames)}`);

        // Get POD Position
        const totalPODs = names.length;
        let position = -1;
        names.forEach((value, index) => {
          if (value == currentPod) {
            position = index;
          }
        });

        if (position == -1) {
          throw new Error(`POD [${currentPod}] position not found`);
        }
        logger.infoWithContext(`At position ${position}`);

        const partitions = [];
        for (let i = 0; i < maxTopicPartition; i++) {
          if (i % totalPODs == position) {
            partitions.push(i);
          }
        }
        logger.infoWithContext(`Get partitions V2 ${partitions}`);
        return partitions;
      } catch (error) {
        logger.errorWithContext({ error, message: 'Error get Assigned Partitions' });
        return [];
      }
    }
  }
};

module.exports = Assignor;