'use strict';
const Sequelize = require('sequelize');
const settings = require('../setting').mysql;
const logger = require('./logger');
const Op = Sequelize.Op;
const operatorsAliases = {
  $eq: Op.eq,
  $ne: Op.ne,
  $gte: Op.gte,
  $gt: Op.gt,
  $lte: Op.lte,
  $lt: Op.lt,
  $not: Op.not,
  $in: Op.in,
  $notIn: Op.notIn,
  $is: Op.is,
  $like: Op.like,
  $notLike: Op.notLike,
  $iLike: Op.iLike,
  $notILike: Op.notILike,
  $regexp: Op.regexp,
  $notRegexp: Op.notRegexp,
  $iRegexp: Op.iRegexp,
  $notIRegexp: Op.notIRegexp,
  $between: Op.between,
  $notBetween: Op.notBetween,
  $overlap: Op.overlap,
  $contains: Op.contains,
  $contained: Op.contained,
  $adjacent: Op.adjacent,
  $strictLeft: Op.strictLeft,
  $strictRight: Op.strictRight,
  $noExtendRight: Op.noExtendRight,
  $noExtendLeft: Op.noExtendLeft,
  $and: Op.and,
  $or: Op.or,
  $any: Op.any,
  $all: Op.all,
  $values: Op.values,
  $col: Op.col
};
const privateKey = process.env.SSL_SEQUELIZE;

const sequelize = new Sequelize(settings.dbname, settings.username, settings.password, {
  operatorsAliases,
  host: settings.hostname,
  port: settings.port,
  dialect: 'mysql',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: true,
      ca: privateKey.replace(/\\n/gm, '\n')
    },
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  timezone: '+07:00'
});

sequelize.authenticate()
  .then(() => {
    logger.infoWithContext('Connection has been established successfully.');
  })
  .catch(err => {
    logger.errorWithContext({error: err, message: 'Unable to connect to the database:'})
  });

module.exports = {
  Sequelize: sequelize
}