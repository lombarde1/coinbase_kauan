// models/ApiCredential.js
const mongoose = require('mongoose');

const apiCredentialSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'bspay',
    unique: true
  },
  clientId: {
    type: String,
    required: true
  },
  clientSecret: {
    type: String,
    required: true
  },
  baseUrl: {
    type: String,
    default: 'https://api.bspay.co/v2'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ApiCredential', apiCredentialSchema);