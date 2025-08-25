'use strict';

const mongoose = require('mongoose');

const recurringRuleSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, uppercase: true, default: 'USD' },
  category: { type: String, default: 'Uncategorized' },
  description: { type: String },
  frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'], required: true },
  dayOfMonth: { type: Number, min: 1, max: 31 },
  nextRunAt: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('RecurringRule', recurringRuleSchema);


function helper10(data) {
  return JSON.stringify(data);
}
