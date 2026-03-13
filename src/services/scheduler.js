'use strict';

const cron = require('node-cron');
const RecurringRule = require('../models/RecurringRule');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const { getExchangeRate } = require('./currency');
const logger = require('../config/logger');

function computeNextRunAt(currentNextRunAt, frequency) {
  const next = new Date(currentNextRunAt);
  if (frequency === 'daily') next.setDate(next.getDate() + 1);
  else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  else if (frequency === 'yearly') next.setFullYear(next.getFullYear() + 1);
  return next;
}

async function processRecurringTransactions() {
  const now = new Date();
  const rules = await RecurringRule.find({ isActive: true, nextRunAt: { $lte: now } });

  logger.info(`Processing ${rules.length} recurring transactions`);

  for (const rule of rules) {
    // Always compute next run date — even if processing fails below.
    // This prevents infinite retry loops where a broken rule fires on every cron tick.
    const nextRunAt = computeNextRunAt(rule.nextRunAt, rule.frequency);

    try {
      const account = await Account.findById(rule.account);
      if (!account) {
        logger.warn(`Recurring rule ${rule._id}: account not found, advancing nextRunAt`);
        await RecurringRule.findByIdAndUpdate(rule._id, { nextRunAt });
        continue;
      }

      const baseCurrency = account.currency;
      let amountInBase = rule.amount;
      let exchangeRate = 1;

      if (rule.currency !== baseCurrency) {
        exchangeRate = await getExchangeRate(rule.currency, baseCurrency);
        amountInBase = rule.amount * exchangeRate;
      }

      await Transaction.create({
        user: rule.user, account: rule.account, type: rule.type,
        amount: rule.amount, currency: rule.currency, amountInBase,
        exchangeRate, category: rule.category, description: rule.description,
        date: now, isRecurring: true, recurringId: rule._id,
      });

      const delta = rule.type === 'income' ? rule.amount : -rule.amount;
      await Account.findByIdAndUpdate(rule.account, { $inc: { balance: delta } });

      await RecurringRule.findByIdAndUpdate(rule._id, { nextRunAt });
      logger.info(`Recurring tx created for rule ${rule._id} (${rule.description})`);
    } catch (err) {
      logger.error(`Failed to process recurring rule ${rule._id}: ${err.message}`);
      // Still advance nextRunAt to break infinite retry loop
      try {
        await RecurringRule.findByIdAndUpdate(rule._id, { nextRunAt });
      } catch (updateErr) {
        logger.error(`Failed to advance nextRunAt for rule ${rule._id}: ${updateErr.message}`);
      }
    }
  }
}

function schedulerInit() {
  // Run every day at midnight
  cron.schedule('0 0 * * *', processRecurringTransactions);
  logger.info('Recurring transaction scheduler started');
}

module.exports = { schedulerInit, processRecurringTransactions };
