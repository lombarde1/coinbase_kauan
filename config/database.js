// config/database.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://darkvips:lombarde1@147.79.111.143:27017/coinbase_zapcash', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      authSource: 'admin'
    });
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
};

module.exports = connectDB;