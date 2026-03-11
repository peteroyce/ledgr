'use strict';

const Transaction = require('../models/Transaction');

exports.summary = async (req, res) => {
  try {
    const { from, to, currency } = req.query;
    const dateFilter = {};
    // fixed: use start-of-day for from date
    if (from) dateFilter.$gte = new Date(from);
    if (to) dateFilter.$lte = new Date(to);

    const match = { user: req.user._id };
    if (Object.keys(dateFilter).length) match.date = dateFilter;

    const [summary] = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalIncome: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amountInBase', 0] } },
          totalExpenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amountInBase', 0] } },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $addFields: {
          netSavings: { $subtract: ['$totalIncome', '$totalExpenses'] },
          savingsRate: {
            $cond: [
              { $gt: ['$totalIncome', 0] },
              { $multiply: [{ $divide: [{ $subtract: ['$totalIncome', '$totalExpenses'] }, '$totalIncome'] }, 100] },
              0,
            ],
          },
        },
      },
    ]);

    res.json({ success: true, data: summary || { totalIncome: 0, totalExpenses: 0, netSavings: 0, savingsRate: 0 } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.byCategory = async (req, res) => {
  try {
    const { from, to, type = 'expense' } = req.query;
    const match = { user: req.user._id, type };
    if (from || to) {
      match.date = {};
      if (from) match.date.$gte = new Date(from);
      if (to) match.date.$lte = new Date(to);
    }

    const breakdown = await Transaction.aggregate([
      { $match: match },
      { $group: { _id: '$category', total: { $sum: '$amountInBase' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $project: { category: '$_id', total: 1, count: 1, _id: 0 } },
    ]);

    res.json({ success: true, data: breakdown });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.monthlyTrend = async (req, res) => {
  try {
    const { months = 6 } = req.query;
    const from = new Date();
    from.setMonth(from.getMonth() - Number(months));

    const trend = await Transaction.aggregate([
      { $match: { user: req.user._id, date: { $gte: from } } },
      {
        $group: {
          _id: { year: { $year: '$date' }, month: { $month: '$date' }, type: '$type' },
          total: { $sum: '$amountInBase' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({ success: true, data: trend });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.budgetStatus = async (req, res) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const y = Number(year || now.getFullYear());
    const m = Number(month || now.getMonth() + 1);

    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 0, 23, 59, 59);

    const spending = await Transaction.aggregate([
      { $match: { user: req.user._id, type: 'expense', date: { $gte: from, $lte: to } } },
      { $group: { _id: '$category', spent: { $sum: '$amountInBase' }, count: { $sum: 1 } } },
      { $project: { category: '$_id', spent: 1, count: 1, _id: 0 } },
      { $sort: { spent: -1 } },
    ]);

    res.json({ success: true, period: { year: y, month: m }, data: spending });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Note: all dates stored in UTC; clients should pass ISO 8601 strings with offset
