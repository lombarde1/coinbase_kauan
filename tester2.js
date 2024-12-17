// tester.js
const axios = require('axios');
const colors = require('colors');

const BASE_URL = 'https://call.evolucaohot.online/api';
const TEST_USER_ID = '675cb201d752ecb95d1e22f9'; // Substitua por um ID válido do seu banco

class PaymentTester {
  constructor() {
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async runTest(name, testFunction) {
    this.testResults.total++;
    try {
      await testFunction();
      this.testResults.passed++;
      this.testResults.tests.push({
        name,
        status: 'PASSED',
        error: null
      });
      console.log(`✓ ${name}`.green);
    } catch (error) {
      this.testResults.failed++;
      this.testResults.tests.push({
        name,
        status: 'FAILED',
        error: error.message
      });
      console.log(`✗ ${name}`.red);
      console.log(`  Error: ${error.message}`.gray);
    }
  }

  async testBSPayAuth() {
    await this.runTest('BS Pay Authentication', async () => {
      const response = await axios.post(`${BASE_URL}/payment/test-auth`);
      if (!response.data.success) {
        throw new Error('Falha na autenticação com BS Pay');
      }
    });
  }

  async testPixGeneration() {
    await this.runTest('PIX Generation', async () => {
      const response = await axios.post(`${BASE_URL}/payment/generate-pix/${TEST_USER_ID}`, {
        amount: 100.00,
        email: 'test@example.com'
      });

      if (!response.data.success || !response.data.data.qrCode) {
        throw new Error('Falha ao gerar QR Code PIX');
      }

      // Guarda o transactionId para outros testes
      this.transactionId = response.data.data.transactionId;
    });
  }

  async testTransactionStatus() {
    await this.runTest('Transaction Status Check', async () => {
      if (!this.transactionId) {
        throw new Error('Nenhuma transação disponível para verificar');
      }

      const response = await axios.get(`${BASE_URL}/payment/check-status/${this.transactionId}`);
      
      if (!response.data.success || !response.data.data.status) {
        throw new Error('Falha ao verificar status da transação');
      }
    });
  }

  async testCallbackProcessing() {
    await this.runTest('Payment Callback Processing', async () => {
      if (!this.transactionId) {
        throw new Error('Nenhuma transação disponível para teste de callback');
      }

      const callbackData = {
        requestBody: {
          transactionId: this.transactionId,
          external_id: 'TEST_' + Date.now(),
          status: 'CONFIRMED',
          amount: 100.00
        }
      };

      const response = await axios.post(`${BASE_URL}/payment/callback`, callbackData);
      
      if (!response.data.success) {
        throw new Error('Falha ao processar callback de pagamento');
      }
    });
  }

  async testUserBalanceUpdate() {
    await this.runTest('User Balance Update', async () => {
      const response = await axios.get(`${BASE_URL}/users/balance/${TEST_USER_ID}`);
      
      if (!response.data.success) {
        throw new Error('Falha ao verificar saldo do usuário');
      }
    });
  }

  generateReport() {
    console.log('\n=== Relatório de Testes ==='.cyan);
    console.log(`Total de testes: ${this.testResults.total}`);
    console.log(`Passou: ${this.testResults.passed}`.green);
    console.log(`Falhou: ${this.testResults.failed}`.red);
    console.log('\nDetalhes:'.cyan);
    
    this.testResults.tests.forEach(test => {
      const status = test.status === 'PASSED' 
        ? test.status.green 
        : test.status.red;
      
      console.log(`\n${test.name}`);
      console.log(`Status: ${status}`);
      if (test.error) {
        console.log(`Erro: ${test.error}`.gray);
      }
    });

    // Retorna true se todos os testes passaram
    return this.testResults.failed === 0;
  }

  async runAllTests() {
    console.log('Iniciando testes do sistema de pagamento...\n'.cyan);

    await this.testBSPayAuth();
    await this.testPixGeneration();
    await this.testTransactionStatus();
    await this.testCallbackProcessing();
    await this.testUserBalanceUpdate();

    const success = this.generateReport();

    if (success) {
      console.log('\n✓ Todos os testes passaram com sucesso!'.green);
    } else {
      console.log('\n✗ Alguns testes falharam. Verifique os detalhes acima.'.red);
    }

    return success;
  }
}

// Executa os testes
if (require.main === module) {
  const tester = new PaymentTester();
  tester.runAllTests().catch(console.error);
}

module.exports = PaymentTester;