'use strict';

const { validationResult } = require('express-validator');
const RecurringRule = require('../models/RecurringRule');
const Account = require('../models/Account');

exports.createRule = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const { account: accountId, type, amount, currency, category, description, frequency, dayOfMonth, nextRunAt } = req.body;

    const account = await Account.findOne({ _id: accountId, user: req.user._id });
    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });

    const rule = await RecurringRule.create({
      user: req.user._id,
      account: accountId,
      type,
      amount,
      currency,
      category,
      description,
      frequency,
      dayOfMonth,
      nextRunAt,
    });
    res.status(201).json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getRules = async (req, res) => {
  try {
    const rules = await RecurringRule.find({ user: req.user._id })
      .populate('account', 'name currency')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: rules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getRule = async (req, res) => {
  try {
    const rule = await RecurringRule.findOne({ _id: req.params.id, user: req.user._id })
      .populate('account', 'name currency');
    if (!rule) return res.status(404).json({ success: false, error: 'Recurring rule not found' });
    res.json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateRule = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const ALLOWED = ['amount', 'currency', 'category', 'description', 'frequency', 'dayOfMonth', 'nextRunAt', 'isActive'];
    const safeUpdate = {};
    for (const field of ALLOWED) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        safeUpdate[field] = req.body[field];
      }
    }

    const rule = await RecurringRule.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      safeUpdate,
      { new: true, runValidators: true }
    );
    if (!rule) return res.status(404).json({ success: false, error: 'Recurring rule not found' });
    res.json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteRule = async (req, res) => {
  try {
    const rule = await RecurringRule.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!rule) return res.status(404).json({ success: false, error: 'Recurring rule not found' });
    res.json({ success: true, message: 'Recurring rule deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
