// routes/activity.js
const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const WithdrawRequest = require('../models/WithdrawRequest');

router.get('/activities/:userId', async (req, res) => {
  try {
    // Busca todas as atividades em paralelo
    const [transactions, withdrawRequests] = await Promise.all([
      Transaction.find({ 
        userId: req.params.userId 
      }).sort({ createdAt: -1 }),
      WithdrawRequest.find({ 
        userId: req.params.userId 
      }).sort({ createdAt: -1 })
    ]);

    // Combina e organiza as atividades
    const activities = [
      ...transactions.map(t => ({
        type: 'transaction',
        category: t.type,
        amount: t.amount,
        status: t.status,
        date: t.createdAt,
        description: t.description || getTransactionDescription(t),
        data: t
      })),
      ...withdrawRequests.map(w => ({
        type: 'withdraw',
        category: w.type,
        amount: w.amount,
        status: w.status,
        date: w.createdAt,
        description: `Solicitação de saque - ${w.type === 'commission' ? 'Comissões' : 'Saldo'}`,
        expiresAt: w.expiresAt,
        data: w
      }))
    ].sort((a, b) => b.date - a.date);

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Função auxiliar para descrições
function getTransactionDescription(transaction) {
  const descriptions = {
    deposit: 'Depósito via PIX',
    withdraw: 'Saque processado',
    crypto_purchase: 'Compra de criptomoeda',
    crypto_sale: 'Venda de criptomoeda',
    referral_bonus: 'Comissão de afiliado',
    admin_adjustment: 'Ajuste administrativo'
  };
  return descriptions[transaction.type] || 'Transação';
}

module.exports = router;