'use strict';

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  type: { type: String, enum: ['income', 'expense', 'transfer'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, uppercase: true, default: 'USD', minlength: 3, maxlength: 3 },
  amountInBase: { type: Number }, // converted to user's base currency
  exchangeRate: { type: Number, default: 1 },
  category: { type: String, trim: true, default: 'Uncategorized' },
  tags: [{ type: String, trim: true, lowercase: true }],
  description: { type: String, trim: true },
  date: { type: Date, default: Date.now },
  isRecurring: { type: Boolean, default: false },
  recurringId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringRule' },
}, { timestamps: true });

transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, category: 1 });
transactionSchema.index({ user: 1, account: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);

// Category budget limits stored per-user in a separate collection (future: BudgetLimit model)
