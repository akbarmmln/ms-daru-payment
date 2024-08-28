const Sequelize = require('sequelize');
const dbConnection = require('../config/db').Sequelize;

const adrUserTransaction = (partition) => {
	return dbConnection.define(`user_transaction_p${partition}`, {
		id: {
			type: Sequelize.STRING,
			primaryKey: true
		},
		created_dt: Sequelize.DATE(6),
		created_by: Sequelize.STRING,
		modified_dt: Sequelize.DATE(6),
		modified_by: Sequelize.STRING,
		is_deleted: Sequelize.INTEGER,
		request_id: Sequelize.STRING,
		account_id: Sequelize.STRING,
		amount: Sequelize.DECIMAL,
		transaction_type: Sequelize.STRING,
		state: Sequelize.STRING,
		payload: Sequelize.STRING,
		status: Sequelize.INTEGER,
        partition: Sequelize.STRING,
	}, {
		freezeTableName: true,
		timestamps: false,
		tableName: `user_transaction_p${partition}`,	
	});
};

module.exports = adrUserTransaction