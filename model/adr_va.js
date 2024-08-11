const Sequelize = require('sequelize');
const dbConnection = require('../config/db').Sequelize;

const adrVA = dbConnection.define('adr_va', {
  id: {
    type: Sequelize.STRING,
    primaryKey: true
  },
  created_dt: Sequelize.DATE(6),
  created_by: Sequelize.STRING,
  modified_dt: Sequelize.DATE(6),
  modified_by: Sequelize.STRING,
  is_deleted: Sequelize.INTEGER,
  va_number: Sequelize.STRING,
  balance: Sequelize.DECIMAL,
  account_id: Sequelize.STRING,
}, {
  freezeTableName: true,
  timestamps: false,
  tableName: 'adr_va'
});

module.exports = adrVA;