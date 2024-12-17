
// routes/wallet.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const CryptoWallet = require('../models/CryptoWallet');

// Preços atualizados das criptomoedas
const cryptoPrices = {
  BTC: {
    price: 613793.77,
    variation: 0.94,
    name: "Bitcoin"
  },
  ETH: {
    price: 23507.24,
    variation: -0.69,
    name: "Ethereum"
  },
  BNB: {
    price: 2340.15,
    variation: 1.25,
    name: "BNB"
  },
  SOL: {
    price: 1340.34,
    variation: -0.04,
    name: "Solana"
  },
  ADA: {
    price: 3.45,
    variation: 2.15,
    name: "Cardano"
  },
  DOT: {
    price: 180.92,
    variation: -1.32,
    name: "Polkadot"
  },
  XRP: {
    price: 2.84,
    variation: 0.75,
    name: "XRP"
  },
  DOGE: {
    price: 0.85,
    variation: 3.45,
    name: "Dogecoin"
  },
  AVAX: {
    price: 456.78,
    variation: -0.92,
    name: "Avalanche"
  },
  LINK: {
    price: 89.34,
    variation: 1.56,
    name: "Chainlink"
  },
  MATIC: {
    price: 5.67,
    variation: 2.34,
    name: "Polygon"
  },
  LTC: {
    price: 722.89,
    variation: 0.21,
    name: "Litecoin"
  },
  UNI: {
    price: 45.23,
    variation: -1.23,
    name: "Uniswap"
  },
  XLM: {
    price: 0.56,
    variation: 0.89,
    name: "Stellar"
  },
  ATOM: {
    price: 123.45,
    variation: 1.78,
    name: "Cosmos"
  }
};

// Rota para listar todas as criptomoedas com preços e variações
router.get('/crypto-prices', async (req, res) => {
  try {
    res.json({
      success: true,
      data: cryptoPrices
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota para comprar qualquer criptomoeda
router.post('/buy-crypto/:userId', async (req, res) => {
  try {
    const { symbol, amount } = req.body; // amount em reais
    const user = await User.findById(req.params.userId);
    
    if (!cryptoPrices[symbol]) {
      return res.status(400).json({
        success: false,
        error: 'Criptomoeda não encontrada'
      });
    }
    
    // Verifica se usuário tem saldo
    if (user.balance < amount) {
      return res.status(400).json({
        success: false,
        error: 'Saldo insuficiente'
      });
    }

    // Calcula quantidade de cripto
    const cryptoAmount = amount / cryptoPrices[symbol].price;

    // Busca ou cria carteira
    let wallet = await CryptoWallet.findOne({ userId: req.params.userId });
    if (!wallet) {
      wallet = new CryptoWallet({
        userId: req.params.userId,
        coins: []
      });
    }

    // Adiciona ou atualiza moeda na carteira
    const coinIndex = wallet.coins.findIndex(c => c.symbol === symbol);
    if (coinIndex >= 0) {
      wallet.coins[coinIndex].amount += cryptoAmount;
      wallet.coins[coinIndex].purchasePrice = 
        (wallet.coins[coinIndex].purchasePrice + cryptoPrices[symbol].price) / 2;
    } else {
      wallet.coins.push({
        symbol,
        amount: cryptoAmount,
        purchasePrice: cryptoPrices[symbol].price
      });
    }

    // Atualiza saldo do usuário
    user.balance -= amount;

    // Registra transação
    const transaction = new Transaction({
      userId: req.params.userId,
      type: 'crypto_purchase',
      amount,
      status: 'completed',
      description: `Compra de ${cryptoAmount.toFixed(8)} ${symbol}`
    });

    await wallet.save();
    await user.save();
    await transaction.save();

    res.json({
      success: true,
      data: {
        wallet,
        transaction,
        newBalance: user.balance
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota para vender criptomoeda
router.post('/sell-crypto/:userId', async (req, res) => {
  try {
    const { symbol, cryptoAmount } = req.body;
    const wallet = await CryptoWallet.findOne({ userId: req.params.userId });
    const user = await User.findById(req.params.userId);

    if (!cryptoPrices[symbol]) {
      return res.status(400).json({
        success: false,
        error: 'Criptomoeda não encontrada'
      });
    }

    // Verifica se tem moeda suficiente
    const coinIndex = wallet?.coins?.findIndex(c => c.symbol === symbol) ?? -1;
    if (!wallet || coinIndex === -1 || wallet.coins[coinIndex].amount < cryptoAmount) {
      return res.status(400).json({
        success: false,
        error: 'Saldo insuficiente de criptomoeda'
      });
    }

    // Calcula valor em reais
    const fiatAmount = cryptoAmount * cryptoPrices[symbol].price;

    // Atualiza carteira
    wallet.coins[coinIndex].amount -= cryptoAmount;
    if (wallet.coins[coinIndex].amount < 0.00000001) {
      wallet.coins.splice(coinIndex, 1);
    }

    // Atualiza saldo do usuário
    user.balance += fiatAmount;

    // Registra transação
    const transaction = new Transaction({
      userId: req.params.userId,
      type: 'crypto_sale',
      amount: fiatAmount,
      status: 'completed',
      description: `Venda de ${cryptoAmount.toFixed(8)} ${symbol}`
    });

    await wallet.save();
    await user.save();
    await transaction.save();

    res.json({
      success: true,
      data: {
        wallet,
        transaction,
        newBalance: user.balance
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota para ver carteira com valores atualizados
router.get('/portfolio/:userId', async (req, res) => {
  try {
    const wallet = await CryptoWallet.findOne({ userId: req.params.userId });
    
    if (!wallet) {
      return res.json({
        success: true,
        data: {
          coins: [],
          totalValue: 0
        }
      });
    }

    // Calcula valores atualizados
    const portfolioDetails = wallet.coins.map(coin => {
      const currentPrice = cryptoPrices[coin.symbol].price;
      const currentValue = coin.amount * currentPrice;
      const purchaseValue = coin.amount * coin.purchasePrice;
      const profit = currentValue - purchaseValue;
      const profitPercentage = (profit / purchaseValue) * 100;

      return {
        symbol: coin.symbol,
        name: cryptoPrices[coin.symbol].name,
        amount: coin.amount,
        currentPrice,
        currentValue,
        purchasePrice: coin.purchasePrice,
        purchaseValue,
        profit,
        profitPercentage,
        variation24h: cryptoPrices[coin.symbol].variation
      };
    });

    const totalValue = portfolioDetails.reduce((sum, coin) => sum + coin.currentValue, 0);

    res.json({
      success: true,
      data: {
        coins: portfolioDetails,
        totalValue
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


router.post('/deposit/:userId', async (req, res) => {
    try {
      const { amount } = req.body;
      const transaction = new Transaction({
        userId: req.params.userId,
        type: 'deposit',
        amount,
        status: 'pending'
      });
  
      await transaction.save();
      res.json({ success: true, data: transaction });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  router.post('/withdraw/:userId', async (req, res) => {
    try {
      const { amount } = req.body;
      const user = await User.findById(req.params.userId);
  
      if (user.balance < amount) {
        return res.status(400).json({ success: false, error: 'Insufficient funds' });
      }
  
      const transaction = new Transaction({
        userId: req.params.userId,
        type: 'withdraw',
        amount,
        status: 'pending'
      });
  
      await transaction.save();
      res.json({ success: true, data: transaction });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  


  router.get('/crypto-prices', async (req, res) => {
    try {
      res.json({ success: true, data: cryptoPrices });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

module.exports = router;