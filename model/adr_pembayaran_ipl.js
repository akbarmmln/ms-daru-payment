const Sequelize = require('sequelize');
const dbConnection = require('../config/db').Sequelize;

const adrPembayaranIPL = (partition) => {
	return dbConnection.define(`pembayaran_ipl_${partition}`, {
		id: {
			type: Sequelize.STRING,
			primaryKey: true
		},
		created_dt: Sequelize.DATE(6),
		created_by: Sequelize.STRING,
		modified_dt: Sequelize.DATE(6),
		modified_by: Sequelize.STRING,
		is_deleted: Sequelize.INTEGER,
		account_id: Sequelize.STRING,
		pembayaran_bulan: Sequelize.INTEGER,
		detail_pembayaran: Sequelize.STRING,
		jumlah_tagihan: Sequelize.DECIMAL,
		referensi: Sequelize.STRING,
		pembayaran_susulan: Sequelize.INTEGER,
	}, {
		freezeTableName: true,
		timestamps: false,
		tableName: `pembayaran_ipl_${partition}`,	
	});
};

module.exports = adrPembayaranIPL