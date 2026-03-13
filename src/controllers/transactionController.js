'use strict';

const { validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const { getExchangeRate } = require('../services/currency');

// Fields that are safe to update via PUT/PATCH
const ALLOWED_UPDATE_FIELDS = ['amount', 'type', 'category', 'description', 'date', 'accountId', 'currency', 'tags'];

exports.create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const { accountId, type, amount, currency, category, tags, description, date } = req.body;
    const account = await Account.findOne({ _id: accountId, user: req.user._id });
    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });

    const baseCurrency = req.user.baseCurrency || 'USD';
    let amountInBase = amount;
    let exchangeRate = 1;

    if (currency && currency !== baseCurrency) {
      exchangeRate = await getExchangeRate(currency, baseCurrency);
      amountInBase = amount * exchangeRate;
    }

    const tx = await Transaction.create({
      user: req.user._id, account: accountId, type, amount, currency: currency || baseCurrency,
      amountInBase, exchangeRate, category, tags, description, date,
    });

    // Atomic balance update using $inc
    const delta = type === 'income' ? amount : -amount;
    await Account.findByIdAndUpdate(accountId, { $inc: { balance: delta } });

    res.status(201).json({ success: true, transaction: tx });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.list = async (req, res) => {
  try {
    const { account, category, type, from, to } = req.query;

    // Bound pagination parameters
    let page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 20;
    page = Math.min(Math.max(page, 1), 1000);
    limit = Math.min(Math.max(limit, 1), 100);

    const filter = { user: req.user._id };
    if (account) filter.account = account;
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(limit).populate('account', 'name currency'),
      Transaction.countDocuments(filter),
    ]);

    res.json({ success: true, data: transactions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const tx = await Transaction.findOne({ _id: req.params.id, user: req.user._id }).populate('account', 'name currency');
    if (!tx) return res.status(404).json({ success: false, error: 'Transaction not found' });
    res.json({ success: true, transaction: tx });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.update = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    // Whitelist only allowed fields — never spread req.body directly
    const safeUpdate = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        safeUpdate[field] = req.body[field];
      }
    }

    const tx = await Transaction.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      safeUpdate,
      { new: true, runValidators: true }
    );
    if (!tx) return res.status(404).json({ success: false, error: 'Transaction not found' });
    res.json({ success: true, transaction: tx });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const tx = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!tx) return res.status(404).json({ success: false, error: 'Transaction not found' });

    const delta = tx.type === 'income' ? -tx.amount : tx.amount;
    await Account.findByIdAndUpdate(tx.account, { $inc: { balance: delta } });

    res.json({ success: true, message: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
