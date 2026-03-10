'use strict';

const axios = require('axios');
const logger = require('../config/logger');

// In-memory cache: { 'USD_EUR': { rate, fetchedAt } }
const rateCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getExchangeRate(from, to) {
  if (from === to) return 1;

  const key = `${from}_${to}`;
  const cached = rateCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate;
  }

  try {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    const { data } = await axios.get(
      `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${from}/${to}`
    );
    const rate = data.conversion_rate;
    rateCache.set(key, { rate, fetchedAt: Date.now() });
    logger.info(`Exchange rate ${from}→${to}: ${rate}`);
    return rate;
  } catch (err) {
    logger.warn(`Exchange rate fetch failed (${from}→${to}): ${err.message}. Using 1.`);
    return 1;
  }
}

module.exports = { getExchangeRate };
