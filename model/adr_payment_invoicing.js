const Sequelize = require('sequelize');
const dbConnection = require('../config/db').Sequelize;

const paymentInvoicing = (partition) => {
	return dbConnection.define(`payment_invoicing_${partition}`, {
		id: {
			type: Sequelize.STRING,
			primaryKey: true
		},
		created_dt: Sequelize.DATE(6),
		created_by: Sequelize.STRING,
		modified_dt: Sequelize.DATE(6),
		modified_by: Sequelize.STRING,
		is_deleted: Sequelize.INTEGER,
		order_id: Sequelize.STRING,
        account_id: Sequelize.STRING,
        transaction_id: Sequelize.STRING,
        merchant_id: Sequelize.STRING,
        transaction_time: Sequelize.DATE(6),
        expiry_time: Sequelize.DATE(6),
        transaction_status: Sequelize.STRING,
        gross_amount: Sequelize.DECIMAL,
        net_amount: Sequelize.DECIMAL,
        currency: Sequelize.STRING,
        va_numbers: Sequelize.STRING,
        store: Sequelize.STRING,
        transaction_type: Sequelize.STRING,
		user_transaction_id: Sequelize.STRING,
	}, {
		freezeTableName: true,
		timestamps: false,
		tableName: `payment_invoicing_${partition}`,	
	});
};

module.exports = paymentInvoicing