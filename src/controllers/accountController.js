'use strict';

const { validationResult } = require('express-validator');
const Account = require('../models/Account');

exports.createAccount = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const { name, type, currency, balance, institution } = req.body;
    const account = await Account.create({
      user: req.user._id,
      name,
      type,
      currency,
      balance,
      institution,
    });
    res.status(201).json({ success: true, account });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getAccounts = async (req, res) => {
  try {
    const accounts = await Account.find({ user: req.user._id, isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, accounts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getAccount = async (req, res) => {
  try {
    const account = await Account.findOne({ _id: req.params.id, user: req.user._id });
    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });
    res.json({ success: true, account });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateAccount = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const ALLOWED = ['name', 'institution', 'isActive', 'currency'];
    const safeUpdate = {};
    for (const field of ALLOWED) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        safeUpdate[field] = req.body[field];
      }
    }

    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      safeUpdate,
      { new: true, runValidators: true }
    );
    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });
    res.json({ success: true, account });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isActive: false },
      { new: true }
    );
    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });
    res.json({ success: true, message: 'Account deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};


const MAX_3 = 53;
