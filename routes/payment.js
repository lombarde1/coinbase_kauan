// routes/payment.js
const express = require('express');
const router = express.Router();
const bspayService = require('../services/bspayService');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const axios = require("axios")
const Referral = require('../models/Referral');

const BS_PAY_CONFIG = {
    clientId: 'djavan003_2011613075',
    clientSecret: 'e2bc05fe15e7d27379d5eee29b2eafa8af6191ff67534f1cc7c4cd9f132f910a',
    baseUrl: 'https://api.bspay.co/v2'
  };

// Gerar PIX para depósito
router.post('/generate-pix/:userId', async (req, res) => {
  try {
    const { amount, email } = req.body;
    
    // Gera o PIX
    const pixData = await bspayService.generatePixQRCode(
      amount, 
      req.params.userId,
      email
    );

    // Registra a transação como pendente
    const transaction = new Transaction({
      userId: req.params.userId,
      type: 'deposit',
      amount: amount,
      status: 'pending',
      transactionId: pixData.transactionId,
      externalId: pixData.externalId
    });

    await transaction.save();

    res.json({
      success: true,
      data: {
        qrCode: pixData.qrcode,
        transactionId: pixData.transactionId,
        amount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


router.post('/test-auth', async (req, res) => {
    try {
      const token = await bspayService.getAuthToken();
      res.json({ success: true, data: { authenticated: true } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });



router.post('/callback', async (req, res) => {
  try {
    const { requestBody } = req.body;
    console.log('Callback recebido:', requestBody);
    
    if (!requestBody) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos no callback'
      });
    }

    const { transactionId } = requestBody;
    const transaction = await Transaction.findOne({ transactionId });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transação não encontrada'
      });
    }

    if (transaction.status === 'completed') {
      return res.json({ success: true, message: "Already processed" });
    }

    const user = await User.findById(transaction.userId);
    if (user) {
      // Atualiza saldo do usuário que fez o depósito
      user.balance += transaction.amount;
      await user.save();

      // Processa comissão para o afiliador
      const referral = await Referral.findOne({
        'usersReferred.userId': user._id,
        'usersReferred.hasDeposited': false
      });

      if (referral && transaction.amount >= 30) {
        const referredUser = referral.usersReferred.find(
          ref => ref.userId.toString() === user._id.toString()
        );

        if (referredUser && !referredUser.hasDeposited) {
          referredUser.hasDeposited = true;
          referredUser.firstDepositAt = new Date();
          referredUser.commissionPaid = true;
          referredUser.commissionPaidAt = new Date();

          // Adiciona comissão ao commissionBalance do afiliador
          const referrer = await User.findById(referral.userId);
          if (referrer) {
            referrer.commissionBalance += 40; // Agora vai para commissionBalance
            await referrer.save();

            const commissionTransaction = new Transaction({
              userId: referral.userId,
              type: 'referral_bonus',
              amount: 50,
              status: 'completed',
              description: `Comissão de afiliado - Depósito de ${user._id}`
            });
            await commissionTransaction.save();

            referral.totalEarnings += 40;
            await referral.save();

            console.log(`Comissão processada: Afiliador ${referral.userId} recebeu R$50 em sua carteira de comissões pelo depósito de ${user._id}`);
          }
        }
      }
    }

    transaction.status = 'completed';
    await transaction.save(); 
      
    try {
      await axios.get('https://api.pushcut.io/jbyazPV1yUlhiPfFX3km8/notifications/Venda%20Realiza');
    } catch (notificationError) {
      console.error('Erro ao enviar notificação:', notificationError);
    }

    res.json({ 
      success: true, 
      message: "Success",
      debug: {
        transactionId,
        userId: transaction.userId,
        amount: transaction.amount
      }
    });
  } catch (error) {
    console.error('Erro no callback:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao processar callback',
      debug: error.message 
    });
  }
});

// Nova rota para verificar histórico de transação
router.get('/transaction-details/:transactionId', async (req, res) => {
    try {
      const transaction = await Transaction.findOne({ 
        transactionId: req.params.transactionId 
      });
  
      if (!transaction) {
        return res.status(404).json({ 
          success: false, 
          error: 'Transação não encontrada' 
        });
      }
  
      const user = await User.findById(transaction.userId);
  
      res.json({
        success: true,
        data: {
          transaction,
          userBalance: user ? user.balance : null,
          userId: transaction.userId
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });


// Verificar status do pagamento
// routes/payment.js
router.get('/check-status/:transactionId', async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      transactionId: req.params.transactionId
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transação não encontrada'
      });
    }

    res.json({
      success: true,
      data: {
        status: transaction.status,
        amount: transaction.amount,
        createdAt: transaction.createdAt
      }
    });
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;