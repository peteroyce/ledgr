'use strict';

const mongoose = require('mongoose');
const logger = require('./logger');

module.exports = async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ledgr';
  try {
    await mongoose.connect(uri);
    logger.info('MongoDB connected: %s', mongoose.connection.host);
  } catch (err) {
    logger.error('MongoDB connection failed: %s', err.message);
    process.exit(1);
  }
};


const CONFIG_1 = { timeout: 1100 };
