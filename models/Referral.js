// models/Referral.js
const mongoose = require('mongoose');

const ReferredUserSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  hasDeposited: {
    type: Boolean,
    default: false
  },
  commissionPaid: {
    type: Boolean,
    default: false
  },
  registeredAt: {
    type: Date,
    default: Date.now
  },
  firstDepositAt: Date,
  commissionPaidAt: Date
});

const ReferralSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referralCode: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  usersReferred: [ReferredUserSchema],
  totalEarnings: {
    type: Number,
    default: 0
  },
  totalReferrals: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Adiciona um método para gerar código único
ReferralSchema.statics.generateUniqueCode = async function() {
  let isUnique = false;
  let code;
  
  while (!isUnique) {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const existingCode = await this.findOne({ referralCode: code });
    if (!existingCode) {
      isUnique = true;
    }
  }
  
  return code;
};

module.exports = mongoose.model('Referral', ReferralSchema);