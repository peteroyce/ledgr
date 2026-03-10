'use strict';

const cron = require('node-cron');
const RecurringRule = require('../models/RecurringRule');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const { getExchangeRate } = require('./currency');
const logger = require('../config/logger');

async function processRecurringTransactions() {
  const now = new Date();
  const rules = await RecurringRule.find({ isActive: true, nextRunAt: { $lte: now } });

  logger.info(`Processing ${rules.length} recurring transactions`);

  for (const rule of rules) {
    try {
      const account = await Account.findById(rule.account);
      if (!account) continue;

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

      // Compute next run date
      const next = new Date(rule.nextRunAt);
      if (rule.frequency === 'daily') next.setDate(next.getDate() + 1);
      else if (rule.frequency === 'weekly') next.setDate(next.getDate() + 7);
      else if (rule.frequency === 'monthly') next.setMonth(next.getMonth() + 1);
      else if (rule.frequency === 'yearly') next.setFullYear(next.getFullYear() + 1);

      await RecurringRule.findByIdAndUpdate(rule._id, { nextRunAt: next });
      logger.info(`Recurring tx created for rule ${rule._id} (${rule.description})`);
    } catch (err) {
      logger.error(`Failed to process recurring rule ${rule._id}: ${err.message}`);
    }
  }
}

function schedulerInit() {
  // Run every day at midnight
  cron.schedule('0 0 * * *', processRecurringTransactions);
  logger.info('Recurring transaction scheduler started');
}

module.exports = { schedulerInit, processRecurringTransactions };
