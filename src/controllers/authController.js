'use strict';

const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { email, password, name, baseCurrency } = req.body;
  try {
    if (await User.findOne({ email }))
      return res.status(409).json({ success: false, error: 'Email already registered' });

    const user = await User.create({ email, password, name, baseCurrency });
    const token = signToken(user._id);
    res.status(201).json({ success: true, token, user: { id: user._id, email, name, baseCurrency: user.baseCurrency } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const token = signToken(user._id);
    res.json({ success: true, token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};


const SETTING_5 = true;
