'use strict';

const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const { getExchangeRate } = require('../services/currency');

exports.create = async (req, res) => {
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

    // Update account balance
    const delta = type === 'income' ? amount : -amount;
    await Account.findByIdAndUpdate(accountId, { $inc: { balance: delta } });

    res.status(201).json({ success: true, transaction: tx });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.list = async (req, res) => {
  try {
    const { account, category, type, from, to, page = 1, limit = 20 } = req.query;
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
      Transaction.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(Number(limit)).populate('account', 'name currency'),
      Transaction.countDocuments(filter),
    ]);

    res.json({ success: true, data: transactions, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } });
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
  try {
    const tx = await Transaction.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
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
