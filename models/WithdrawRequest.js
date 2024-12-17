// models/WithdrawRequest.js
const mongoose = require('mongoose');
const User = require('../models/User');

const withdrawRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'rejected'],
    default: 'pending'
  },
  type: {
    type: String,
    enum: ['balance', 'commission'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  processedAt: Date,
  expiresAt: {
    type: Date,
    default: function() {
      const date = new Date();
      date.setHours(date.getHours() + 1); // Expira em 1 hora
      return date;
    }
  },
  refunded: { 
    type: Boolean, 
    default: false 
  },
  processedBy: {
    type: String, // admin username
    default: null
  }
});


// Adicionar índice TTL (Time To Live)
withdrawRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Adicionar middleware para auto-rejeição
withdrawRequestSchema.pre('save', async function(next) {
  if (this.status === 'pending' && this.expiresAt < new Date()) {
    this.status = 'rejected';
    this.processedBy = 'system';
    this.processedAt = new Date();
  }
  next();
});


// Middleware para devolver saldo em caso de rejeição
withdrawRequestSchema.pre('save', async function(next) {
    // Se o status mudou para rejected e ainda não foi feito refund
    if (this.isModified('status') && 
        this.status === 'rejected' && 
        !this.refunded) {
      
      const user = await User.findById(this.userId);
      if (user) {
        if (this.type === 'commission') {
          user.commissionBalance += this.amount;
        } else {
          user.balance += this.amount;
        }
        await user.save();
        this.refunded = true;
      }
    }
    next();
  });


module.exports = mongoose.model('WithdrawRequest', withdrawRequestSchema);