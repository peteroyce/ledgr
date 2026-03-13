'use strict';

const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['checking', 'savings', 'credit', 'investment', 'cash'],
    required: true,
  },
  currency: { type: String, uppercase: true, default: 'USD', minlength: 3, maxlength: 3 },
  balance: { type: Number, default: 0 },
  institution: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

accountSchema.index({ user: 1, isActive: 1 });

module.exports = mongoose.model('Account', accountSchema);
