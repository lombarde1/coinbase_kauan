// tester.js
const axios = require('axios');
const colors = require('colors');
const mongoose = require('mongoose');

const API_URL = 'https://call.evolucaohot.online/api';
let testReport = [];
let user1Token = '';
let user2Token = '';
let user1ReferralCode = '';

// Função para limpar o banco de dados antes dos testes
const clearDatabase = async () => {
    try {
        await mongoose.connect('mongodb://darkvips:lombarde1@147.79.111.143:27017/coinbase_zapcash', { 
            useNewUrlParser: true, 
            useUnifiedTopology: true, 
            authSource: 'admin' 
        });

        // Configurar strictQuery para evitar warning
        mongoose.set('strictQuery', true);
        
        // Limpar apenas as coleções específicas que usamos
        await mongoose.connection.collection('users').deleteMany({});
        await mongoose.connection.collection('transactions').deleteMany({});
        await mongoose.connection.collection('cryptowallets').deleteMany({});
        await mongoose.connection.collection('referrals').deleteMany({});
        
        console.log('Database cleared successfully'.green);
    } catch (error) {
        if (error.codeName === 'Unauthorized') {
            console.log('Skipping database clear due to permissions...'.yellow);
            return; // Continuar com os testes mesmo sem limpar
        }
        console.error('Error clearing database:', error.message.red);
        process.exit(1);
    }
};

// Função helper para registrar resultados dos testes
const logTest = (testName, success, data = null, error = null) => {
    const result = {
        test: testName,
        success,
        timestamp: new Date().toISOString(),
        data,
        error: error ? (error.response?.data || error.message) : null
    };
    testReport.push(result);
    console.log(`${success ? '✓'.green : '✗'.red} ${testName}`);
    if (error) console.log(`  Error: ${JSON.stringify(result.error, null, 2)}`.red);
    if (data) console.log(`  Data: ${JSON.stringify(data, null, 2)}`.gray);
};

// Função para imprimir o relatório final
const printReport = () => {
    console.log('\n=== RELATÓRIO DE TESTES ===\n'.cyan);
    
    const totalTests = testReport.length;
    const successTests = testReport.filter(t => t.success).length;
    const failedTests = totalTests - successTests;

    console.log(`Total de testes: ${totalTests}`);
    console.log(`Sucesso: ${successTests}`.green);
    console.log(`Falhas: ${failedTests}`.red);
    console.log('\nDetalhes dos testes:'.cyan);

    testReport.forEach((test, index) => {
        console.log(`\n${index + 1}. ${test.test} - ${test.success ? 'SUCESSO'.green : 'FALHA'.red}`);
        if (test.data) console.log(`   Dados: ${JSON.stringify(test.data, null, 2)}`.gray);
        if (test.error) console.log(`   Erro: ${JSON.stringify(test.error, null, 2)}`.red);
    });
};

const runTests = async () => {
    try {
        // Limpar banco de dados antes dos testes
        await clearDatabase();

        // 1. Teste de Registro de Usuários
        console.log('\n=== Testando Registro de Usuários ==='.yellow);
        
        const user1Register = await axios.post(`${API_URL}/auth/register`, {
            name: 'Usuário Teste 1',
            email: 'user1@test.com',
            cpf: '12345678901',
            password: 'senha123'
        });
        user1Token = user1Register.data.data.token;
        logTest('Registro Usuário 1', true, user1Register.data);

        const user2Register = await axios.post(`${API_URL}/auth/register`, {
            name: 'Usuário Teste 2',
            email: 'user2@test.com',
            cpf: '98765432101',
            password: 'senha123'
        });
        user2Token = user2Register.data.data.token;
        logTest('Registro Usuário 2', true, user2Register.data);

        // 2. Teste de Login
        console.log('\n=== Testando Login ==='.yellow);
        
        const user1Login = await axios.post(`${API_URL}/auth/login`, {
            email: 'user1@test.com',
            password: 'senha123'
        });
        logTest('Login Usuário 1', true, user1Login.data);

        // 3. Teste de Verificação de Token
        console.log('\n=== Testando Verificação de Token ==='.yellow);
        
        const verifyToken = await axios.get(`${API_URL}/auth/verify`, {
            headers: { Authorization: `Bearer ${user1Token}` }
        });
        logTest('Verificação de Token', true, verifyToken.data);

        // 4. Teste do Sistema de Referral
        console.log('\n=== Testando Sistema de Referral ==='.yellow);
        
        const generateReferral = await axios.post(`${API_URL}/referral/generate`, {}, {
            headers: { Authorization: `Bearer ${user1Token}` }
        });
        user1ReferralCode = generateReferral.data.data.referralCode;
        logTest('Geração de Código de Referral', true, generateReferral.data);

        const validateReferral = await axios.post(`${API_URL}/referral/validate`, {
            code: user1ReferralCode
        }, {
            headers: { Authorization: `Bearer ${user2Token}` }
        });
        logTest('Validação de Código de Referral', true, validateReferral.data);

        // 5. Teste de Operações de Carteira
        console.log('\n=== Testando Operações de Carteira ==='.yellow);
        
        const deposit = await axios.post(`${API_URL}/wallet/deposit`, {
            amount: 1000
        }, {
            headers: { Authorization: `Bearer ${user1Token}` }
        });
        logTest('Depósito', true, deposit.data);

        const balance = await axios.get(`${API_URL}/users/balance`, {
            headers: { Authorization: `Bearer ${user1Token}` }
        });
        logTest('Consulta de Saldo', true, balance.data);

        const cryptoPrices = await axios.get(`${API_URL}/wallet/crypto-prices`);
        logTest('Consulta de Preços de Criptomoedas', true, cryptoPrices.data);

        // 6. Teste de Histórico
        console.log('\n=== Testando Histórico de Transações ==='.yellow);
        
        const transactions = await axios.get(`${API_URL}/users/transactions`, {
            headers: { Authorization: `Bearer ${user1Token}` }
        });
        logTest('Consulta de Histórico de Transações', true, transactions.data);

        // 7. Teste de Atualização de Perfil
        console.log('\n=== Testando Atualização de Perfil ==='.yellow);
        
        const updateProfile = await axios.put(`${API_URL}/users/profile`, {
            name: 'Usuário 1 Atualizado'
        }, {
            headers: { Authorization: `Bearer ${user1Token}` }
        });
        logTest('Atualização de Perfil', true, updateProfile.data);

    } catch (error) {
        logTest('Erro no teste', false, null, error);
    } finally {
        printReport();
        await mongoose.disconnect();
    }
};

// Executar os testes
console.log('Iniciando testes...'.cyan);
runTests().catch(console.error);