'use strict';

const axios = require('axios');
const logger = require('../config/logger');

// In-memory cache: { 'USD_EUR': { rate, fetchedAt } }
// The cache serves dual purpose: TTL-based fresh rates AND last-good-rate fallback.
const rateCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getExchangeRate(from, to) {
  if (from === to) return 1;

  const key = `${from}_${to}`;
  const cached = rateCache.get(key);

  // Return cached rate if still fresh
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate;
  }

  try {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    const { data } = await axios.get(
      `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${from}/${to}`,
      { timeout: 5000 }
    );
    const rate = data.conversion_rate;
    rateCache.set(key, { rate, fetchedAt: Date.now() });
    logger.info(`Exchange rate ${from}→${to}: ${rate}`);
    return rate;
  } catch (err) {
    // Use last known good rate if available (stale cache), rather than silently returning 1
    if (cached && cached.rate !== undefined) {
      logger.warn(
        `Exchange rate fetch failed (${from}→${to}): ${err.message}. Using last cached rate ${cached.rate} (stale).`
      );
      return cached.rate;
    }
    // No cached rate at all — throw so callers can handle the error explicitly
    logger.error(`Exchange rate fetch failed (${from}→${to}): ${err.message}. No cached rate available.`);
    throw new Error(`Unable to fetch exchange rate for ${from}→${to}: ${err.message}`);
  }
}

module.exports = { getExchangeRate };
