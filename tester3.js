// tester3.js
const axios = require('axios');
const colors = require('colors');

class ReferralTester {
  constructor() {
    this.baseURL = 'http://localhost:8090/api';
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
        error: error.response?.data || error.message
      });
      console.log(`✗ ${name}`.red);
      console.log(`  Error: ${JSON.stringify(error.response?.data || error.message)}`.gray);
    }
  }

  async runAllTests() {
    console.log('\n=== Iniciando Teste do Sistema de Afiliados ===\n'.cyan);

    // Dados de teste
    const affiliate = {
      name: 'Afiliador Teste',
      email: `affiliate${Date.now()}@test.com`,
      cpf: `${Date.now()}`.substring(0, 11), // CPF único
      password: 'test123'
    };

    const referred = {
      name: 'Afiliado Teste',
      email: `referred${Date.now()}@test.com`,
      cpf: `${Date.now() + 1}`.substring(0, 11), // CPF único diferente
      password: 'test123'
    };

    try {
      // 1. Registrar Afiliador
      await this.runTest('Registro do Afiliador', async () => {
        console.log('Tentando registrar afiliador:', affiliate);
        const response = await axios.post(`${this.baseURL}/auth/register`, affiliate);
        this.affiliateId = response.data.data.userId;
        console.log('  Afiliador registrado com ID:', this.affiliateId);
      });

      if (this.affiliateId) {
        // 2. Gerar Código de Afiliado
        await this.runTest('Geração do Código de Afiliado', async () => {
          console.log('Gerando código para afiliador ID:', this.affiliateId);
          const response = await axios.post(`${this.baseURL}/referral/generate-code/${this.affiliateId}`);
          this.referralCode = response.data.data.referralCode;
          console.log('  Código de Afiliado gerado:', this.referralCode);
        });

        // 3. Registrar Usuário Afiliado
        await this.runTest('Registro do Afiliado', async () => {
          console.log('Tentando registrar afiliado:', referred);
          const response = await axios.post(`${this.baseURL}/auth/register`, referred);
          this.referredId = response.data.data.userId;
          console.log('  Afiliado registrado com ID:', this.referredId);
        });

        if (this.referredId && this.referralCode) {
          // 4. Processar Referral
          await this.runTest('Processamento do Referral', async () => {
            const payload = {
              newUserId: this.referredId,
              referralCode: this.referralCode
            };
            console.log('Processando referral:', payload);
            const response = await axios.post(`${this.baseURL}/referral/process`, payload);
            console.log('  Referral processado:', response.data);
          });

          // 5. Simular Depósito do Afiliado
          await this.runTest('Depósito do Afiliado', async () => {
            const depositPayload = {
              amount: 100,
              email: referred.email
            };
            console.log('Gerando PIX para depósito:', depositPayload);
            const pixResponse = await axios.post(
              `${this.baseURL}/payment/generate-pix/${this.referredId}`, 
              depositPayload
            );
            this.transactionId = pixResponse.data.data.transactionId;
            console.log('  TransactionId gerado:', this.transactionId);

            // Simular callback de pagamento
            const callbackPayload = {
              requestBody: {
                transactionId: this.transactionId,
                status: 'CONFIRMED'
              }
            };
            console.log('Simulando callback de pagamento:', callbackPayload);
            await axios.post(`${this.baseURL}/payment/callback`, callbackPayload);
            console.log('  Depósito processado com sucesso');
          });

          // 6. Verificar Comissão
          await this.runTest('Verificação da Comissão', async () => {
            console.log('Verificando saldo do afiliador ID:', this.affiliateId);
            const response = await axios.get(`${this.baseURL}/users/balance/${this.affiliateId}`);
            const balance = response.data.data.balance;
            console.log('  Saldo atual:', balance);
            if (balance !== 50) {
              throw new Error(`Comissão incorreta. Esperado: 50, Recebido: ${balance}`);
            }
          });

          // 7. Verificar Detalhes
          await this.runTest('Verificação dos Detalhes de Afiliados', async () => {
            console.log('Buscando detalhes dos afiliados para ID:', this.affiliateId);
            const response = await axios.get(`${this.baseURL}/referral/referred-users/${this.affiliateId}`);
            console.log('\n=== Detalhes dos Afiliados ==='.cyan);
            console.log(JSON.stringify(response.data.data, null, 2));
          });
        }
      }
    } catch (error) {
      console.error('Erro crítico durante os testes:', error.response?.data || error.message);
    }

    this.generateReport();
  }

  generateReport() {
    console.log('\n=== Relatório Final ==='.cyan);
    console.log(`Total de testes: ${this.testResults.total}`);
    console.log(`Passou: ${this.testResults.passed}`.green);
    console.log(`Falhou: ${this.testResults.failed}`.red);

    console.log('\nDetalhes dos Testes:'.cyan);
    this.testResults.tests.forEach(test => {
      const status = test.status === 'PASSED' ? test.status.green : test.status.red;
      console.log(`\n${test.name}`);
      console.log(`Status: ${status}`);
      if (test.error) {
        console.log(`Erro: ${JSON.stringify(test.error)}`.gray);
      }
    });

    console.log('\n=== IDs Gerados ==='.cyan);
    console.log(`Afiliador ID: ${this.affiliateId || 'Não gerado'}`);
    console.log(`Código de Afiliado: ${this.referralCode || 'Não gerado'}`);
    console.log(`Afiliado ID: ${this.referredId || 'Não gerado'}`);
    console.log(`Transaction ID: ${this.transactionId || 'Não gerado'}`);
  }
}

// Executar os testes
const tester = new ReferralTester();
tester.runAllTests();