// services/bspayService.js
const axios = require('axios');
const ApiCredential = require('../models/ApiCredential');

// Função para buscar credenciais
const getCredentials = async () => {
  const credentials = await ApiCredential.findOne({ name: 'bspay' });
  if (!credentials) {
    throw new Error('BS Pay credentials not found');
  }
  return credentials;
};

// Autenticação com BS Pay
const getAuthToken = async () => {
  const credentials = await getCredentials();
  const auth = Buffer.from(
    `${credentials.clientId}:${credentials.clientSecret}`
  ).toString('base64');

  try {
    const response = await axios.post(
      `${credentials.baseUrl}/oauth/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('Erro na autenticação BS Pay:', error);
    throw new Error('Falha na autenticação com BS Pay');
  }
};

// Gera QR Code do PIX
const generatePixQRCode = async (amount, userId, email) => {
  const credentials = await getCredentials();
  try {
    const token = await getAuthToken();
    const externalId = `DEP_${Date.now()}_${userId}`;

    const response = await axios.post(
      `${credentials.baseUrl}/pix/qrcode`,
      {
        amount: amount,
        payerQuestion: "Depósito via PIX",
        external_id: externalId,
        postbackUrl: "https://kcoin.evolucaohot.online/api/payment/callback",
        payer: {
          name: `User ${userId}`,
          document: '12345678900',
          email: email
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      qrcode: response.data.qrcode,
      transactionId: response.data.transactionId,
      externalId
    };
  } catch (error) {
    console.error('Erro ao gerar PIX:', error);
    throw new Error('Falha ao gerar QR Code PIX');
  }
};

module.exports = { getAuthToken, generatePixQRCode };
