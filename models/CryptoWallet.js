// models/CryptoWallet.js
const mongoose = require('mongoose');

const cryptoWalletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coins: [{
    symbol: String,
    amount: Number,
    purchasePrice: Number
  }]
});

module.exports = mongoose.model('CryptoWallet', cryptoWalletSchema);