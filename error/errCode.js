const errCode = {
  '10000': 'internal server error',
  '70001': 'missing parameter accound id',
  '70002': 'va number tidak ditemukan',
  '70003': 'transaksi tidak ditemukan',
  '70004': 'transaksi tidak diijinkan',
  '70005': 'nominal transaksi lebih besar dari saldo',
  '70006': 'gagal potong saldo',
  '70007': 'gagal tambah saldo',
  '70008': 'maksimal pencarian tanggal adalah 60 hari',
  '70009': 'request body not allowed',
  '70010': 'request gagal, terdapat transaksi tertunda',
};

module.exports = errCode;