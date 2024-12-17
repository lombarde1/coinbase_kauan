// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const JWT_SECRET = 'darkadmcoinbase'

// routes/auth.js - rota de registro modificada
router.post('/register', [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('cpf').isLength({ min: 11, max: 11 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array() });
    }

    const { name, email, cpf, password } = req.body;
    
    let user = await User.findOne({ $or: [{ email }, { cpf }] });
    if (user) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }

    const referralCode = Math.random().toString(36).substring(7);
    
    user = new User({
      name,
      email,
      cpf,
      password,
      referralCode
    });

    await user.save();

    const token = jwt.sign({ userId: user._id }, 'darkadmcoinbase');
    res.json({ 
      success: true, 
      data: { 
        token,
        userId: user._id // Adicionando o ID do usuário na resposta
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ success: false, error: 'Invalid credentials' });
      }
  
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, error: 'Invalid credentials' });
      }
  
      // Retorna apenas o userId ao invés do token
      res.json({ success: true, data: { userId: user._id } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

router.get('/verify', auth, (req, res) => {
  res.json({ success: true, data: { userId: req.user.userId } });
});

module.exports = router;