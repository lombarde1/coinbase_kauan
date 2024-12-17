// routes/referral.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Referral = require('../models/Referral');
const Transaction = require('../models/Transaction');

// Gerar código de referral para um usuário
router.post('/generate-code/:userId', async (req, res) => {
  try {
    // Verifica se já existe um código
    let referral = await Referral.findOne({ userId: req.params.userId });
    
    if (referral) {
      return res.json({
        success: true,
        data: referral
      });
    }

    // Gera um código único
    const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    referral = new Referral({
      userId: req.params.userId,
      referralCode: referralCode,
      usersReferred: [],
      totalEarnings: 0,
      totalReferrals: 0
    });

    await referral.save();

    res.json({
      success: true,
      data: referral
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Buscar informações do referral
router.get('/info/:userId', async (req, res) => {
  try {
    const referral = await Referral.findOne({ userId: req.params.userId })
      .populate('usersReferred', 'name email createdAt');

    if (!referral) {
      return res.status(404).json({
        success: false,
        error: 'Código de referral não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        referralCode: referral.referralCode,
        totalEarnings: referral.totalEarnings,
        totalReferrals: referral.totalReferrals,
        usersReferred: referral.usersReferred,
        referralLink: `https://seusite.com/register?ref=${referral.referralCode}`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Validar código de referral
router.get('/validate/:code', async (req, res) => {
  try {
    const referral = await Referral.findOne({ 
      referralCode: req.params.code.toUpperCase() 
    });

    res.json({
      success: true,
      data: {
        isValid: !!referral,
        referrerId: referral ? referral.userId : null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Processar novo referral (chamada no registro)
// routes/referral.js
router.post('/process', async (req, res) => {
    try {
      const { newUserId, referralCode } = req.body;
      
      if (!referralCode) {
        return res.status(400).json({
          success: false,
          error: 'Código de referral não fornecido'
        });
      }
  
      const referral = await Referral.findOne({ 
        referralCode: referralCode.toUpperCase() 
      });
  
      if (!referral) {
        return res.status(400).json({
          success: false,
          error: 'Código de referral inválido'
        });
      }
  
      // Adiciona novo usuário à lista de referidos
      referral.usersReferred.push({
        userId: newUserId,
        hasDeposited: false,
        commissionPaid: false
      });
      
      referral.totalReferrals += 1;
      await referral.save();
  
      res.json({
        success: true,
        data: { referral }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Rota para processar comissão após depósito
// Em routes/referral.js - na rota process-commission
router.post('/process-commission', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    
    const referral = await Referral.findOne({
      'usersReferred.userId': userId,
      'usersReferred.hasDeposited': false
    });

    if (!referral) {
      return res.status(404).json({
        success: false,
        error: 'Referral não encontrado ou comissão já processada'
      });
    }

    // Verifica depósito mínimo (30 reais)
    if (amount < 1) {
      return res.status(400).json({
        success: false,
        error: 'Depósito menor que o mínimo necessário'
      });
    }

    const referredUser = referral.usersReferred.find(
      user => user.userId.toString() === userId
    );

    if (referredUser && !referredUser.hasDeposited) {
      referredUser.hasDeposited = true;
      referredUser.firstDepositAt = new Date();
      referredUser.commissionPaid = true;
      referredUser.commissionPaidAt = new Date();

      // Adiciona a comissão ao saldo de comissões do afiliador
      const referrer = await User.findById(referral.userId);
      referrer.commissionBalance += 40; // Agora vai para commissionBalance

      const transaction = new Transaction({
        userId: referral.userId,
        type: 'referral_bonus',
        amount: 40,
        status: 'completed',
        description: `Comissão de afiliado - Depósito de ${userId}`
      });

      referral.totalEarnings += 40;

      await transaction.save();
      await referrer.save();
      await referral.save();

      res.json({
        success: true,
        data: {
          referral,
          commission: 40
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Comissão já foi processada'
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
  
  // Rota para visualizar detalhes dos afiliados

// routes/referral.js
// routes/referral.js
router.get('/referred-users/:userId', async (req, res) => {
    try {
      let referral = await Referral.findOne({ userId: req.params.userId });
  
      // Se não existir referral, cria um novo
      if (!referral) {
        try {
          const uniqueCode = await Referral.generateUniqueCode();
          
          referral = new Referral({
            userId: req.params.userId,
            referralCode: uniqueCode,
            usersReferred: [],
            totalEarnings: 0,
            totalReferrals: 0
          });
  
          await referral.save();
        } catch (createError) {
          console.error('Erro ao criar referral:', createError);
          throw createError;
        }
      }
  
      // Popula os dados dos usuários referidos
      await referral.populate({
        path: 'usersReferred.userId',
        select: 'name email createdAt'
      });
  
      const referredUsersDetails = await Promise.all(
        referral.usersReferred.map(async (user) => {
          let transactions = [];
          if (user.userId) {
            transactions = await Transaction.find({
              userId: user.userId._id,
              type: 'deposit',
              status: 'completed'
            }).sort({ createdAt: -1 });
          }
  
          return {
            user: user.userId || null,
            registeredAt: user.registeredAt,
            hasDeposited: user.hasDeposited,
            firstDepositAt: user.firstDepositAt,
            commissionPaid: user.commissionPaid,
            commissionPaidAt: user.commissionPaidAt,
            totalDeposits: transactions.reduce((sum, t) => sum + t.amount, 0),
            lastDeposit: transactions[0]?.createdAt || null
          };
        })
      );
  
      res.json({
        success: true,
        data: {
          referralCode: referral.referralCode,
          totalEarnings: referral.totalEarnings,
          totalReferrals: referral.totalReferrals,
          referredUsers: referredUsersDetails
        }
      });
    } catch (error) {
      console.error('Erro ao buscar usuários referidos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

module.exports = router;