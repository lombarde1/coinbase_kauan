// routes/admin.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Referral = require('../models/Referral');
const WithdrawRequest = require('../models/WithdrawRequest');
const ApiCredential = require('../models/ApiCredential');
// Credenciais do admin (em produção, isso deveria estar em variáveis de ambiente)


const ADMIN_CREDENTIALS = {
  username: 'moneymoney',
  password: 'admincoin'
};



// Middleware de autenticação simples
const adminAuth = (req, res, next) => {
  const { username, password } = req.headers;
  
  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    next();
  } else {
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
};

// Autenticação do Admin
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    res.json({
      success: true,
      data: {
        message: 'Admin authenticated'
      }
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
});

router.get('/credentials/bspay', adminAuth, async (req, res) => {
  try {
    const credentials = await ApiCredential.findOne({ name: 'bspay' });
    res.json({
      success: true,
      data: credentials
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Atualizar credenciais
router.post('/credentials/bspay', adminAuth, async (req, res) => {
  try {
    const { clientId, clientSecret, baseUrl } = req.body;

    const credentials = await ApiCredential.findOneAndUpdate(
      { name: 'bspay' },
      {
        clientId,
        clientSecret,
        baseUrl,
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      data: credentials
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/withdraw-requests', adminAuth, async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    const requests = await WithdrawRequest.find({ status })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Processar saque (aprovar/rejeitar)
// Em routes/admin.js
router.post('/process-withdraw/:requestId', adminAuth, async (req, res) => {
  try {
    const { status, username } = req.body;
    const request = await WithdrawRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        error: 'Withdraw request not found' 
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Request already processed'
      });
    }

    // Buscar usuário separadamente
    const user = await User.findById(request.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (status === 'completed') {
      // Registra a transação
      const transaction = new Transaction({
        userId: user._id,
        type: 'withdraw',
        amount: request.amount,
        status: 'completed',
        description: `Saque de ${request.type === 'commission' ? 'comissão' : 'saldo'} aprovado`
      });

      await transaction.save();
    } else if (status === 'rejected') {
      // Se rejeitado, devolve o saldo
      if (request.type === 'commission') {
        user.commissionBalance += request.amount;
      } else {
        user.balance += request.amount;
      }
      await user.save();
    }

    request.status = status;
    request.processedAt = new Date();
    request.processedBy = username;
    await request.save();

    res.json({
      success: true,
      data: {
        request,
        user: {
          id: user._id,
          balance: user.balance,
          commissionBalance: user.commissionBalance
        }
      }
    });
  } catch (error) {
    console.error('Erro ao processar saque:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Listar todos os usuários com paginação e filtros
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = -1 } = req.query;
    
    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { cpf: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ [sortBy]: sortOrder })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Atualizar saldo do usuário
router.post('/users/balance', adminAuth, async (req, res) => {
  try {
    const { userId, amount, operation, reason } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const oldBalance = user.balance;
    if (operation === 'add') {
      user.balance += amount;
    } else if (operation === 'subtract') {
      user.balance = Math.max(0, user.balance - amount);
    } else if (operation === 'set') {
      user.balance = amount;
    }

    // Registra a transação
    const transaction = new Transaction({
      userId: userId,
      type: 'admin_adjustment',
      amount: Math.abs(user.balance - oldBalance),
      status: 'completed',
      description: `Admin balance adjustment: ${reason || 'No reason provided'}`
    });

    await Promise.all([user.save(), transaction.save()]);

    res.json({
      success: true,
      data: {
        user,
        transaction
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Dashboard stats
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const [
      totalUsers,
      totalBalance,
      totalDeposits,
      totalWithdraws,
      recentTransactions,
      topUsers
    ] = await Promise.all([
      User.countDocuments(),
      User.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]),
      Transaction.aggregate([
        { $match: { type: 'deposit', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: 'withdraw', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('userId', 'name email'),
      User.find()
        .sort({ balance: -1 })
        .limit(5)
        .select('name email balance')
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalBalance: totalBalance[0]?.total || 0,
        totalDeposits: totalDeposits[0]?.total || 0,
        totalWithdraws: totalWithdraws[0]?.total || 0,
        recentTransactions,
        topUsers
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Referral System Stats
router.get('/referrals', adminAuth, async (req, res) => {
  try {
    const [
      totalReferrals,
      totalCommissions,
      topReferrers
    ] = await Promise.all([
      Referral.aggregate([
        { $group: { _id: null, total: { $sum: '$totalReferrals' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: 'referral_bonus', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Referral.find()
        .sort({ totalEarnings: -1 })
        .limit(10)
        .populate('userId', 'name email')
    ]);

    res.json({
      success: true,
      data: {
        totalReferrals: totalReferrals[0]?.total || 0,
        totalCommissions: totalCommissions[0]?.total || 0,
        topReferrers
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Detalhes completos do usuário
router.get('/users/:userId', adminAuth, async (req, res) => {
  try {
    const [user, transactions, referral] = await Promise.all([
      User.findById(req.params.userId).select('-password'),
      Transaction.find({ userId: req.params.userId }).sort({ createdAt: -1 }),
      Referral.findOne({ userId: req.params.userId }).populate('usersReferred.userId', 'name email')
    ]);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      data: {
        user,
        transactions,
        referral
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bloquear/Desbloquear usuário
router.post('/users/:userId/toggle-status', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;