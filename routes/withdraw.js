// routes/withdraw.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const WithdrawRequest = require('../models/WithdrawRequest');
const Transaction = require('../models/Transaction');

// Solicitar saque da carteira de comissões
router.post('/commission/:userId', async (req, res) => {
    try {
      const { amount } = req.body;
      const user = await User.findById(req.params.userId);
  
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
  
      if (user.commissionBalance < amount) {
        return res.status(400).json({ 
          success: false, 
          error: 'Insufficient commission balance' 
        });
      }
  
      // Desconta o saldo imediatamente
      user.commissionBalance -= amount;
      await user.save();
  
      const withdrawRequest = new WithdrawRequest({
        userId: user._id,
        amount,
        type: 'commission'
      });
  
      // Se o saque for rejeitado, o saldo será devolvido
      withdrawRequest.on('rejected', async () => {
        user.commissionBalance += amount;
        await user.save();
      });
  
      await withdrawRequest.save();
  
      res.json({
        success: true,
        data: {
          withdrawRequest,
          newCommissionBalance: user.commissionBalance
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });


// Solicitar saque do saldo normal
router.post('/balance/:userId', async (req, res) => {
  try {
    const { amount } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (user.balance < amount) {
      return res.status(400).json({ 
        success: false, 
        error: 'Insufficient balance' 
      });
    }

    // Desconta o saldo imediatamente
    user.balance -= amount;
    await user.save();

    const withdrawRequest = new WithdrawRequest({
      userId: user._id,
      amount,
      type: 'balance'
    });

    // Se o saque for rejeitado (seja por admin ou por expiração), o saldo é devolvido
    withdrawRequest.on('rejected', async () => {
      user.balance += amount;
      await user.save();

      // Registra a devolução
      const transaction = new Transaction({
        userId: user._id,
        type: 'withdraw_refund',
        amount,
        status: 'completed',
        description: 'Devolução de saque rejeitado'
      });
      await transaction.save();
    });

    await withdrawRequest.save();

    res.json({
      success: true,
      data: {
        withdrawRequest,
        newBalance: user.balance
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});



// Listar saques pendentes do usuário
router.get('/requests/:userId', async (req, res) => {
  try {
    const withdrawRequests = await WithdrawRequest.find({
      userId: req.params.userId
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: withdrawRequests
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;