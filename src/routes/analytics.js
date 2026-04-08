'use strict';

const router = require('express').Router();
const { query } = require('express-validator');
const authenticate = require('../middleware/auth');
const ctrl = require('../controllers/analyticsController');

router.use(authenticate);

const dateRangeValidation = [
  query('from').optional().isISO8601().withMessage('from must be a valid ISO 8601 date'),
  query('to').optional().isISO8601().withMessage('to must be a valid ISO 8601 date'),
];

const trendValidation = [
  query('months').optional().isInt({ min: 1, max: 24 }).withMessage('months must be an integer between 1 and 24'),
];

const budgetValidation = [
  query('month').optional().isInt({ min: 1, max: 12 }).withMessage('month must be an integer between 1 and 12'),
  query('year').optional().isInt({ min: 2000, max: 2100 }).withMessage('year must be an integer between 2000 and 2100'),
];

router.get('/summary', dateRangeValidation, ctrl.summary);
router.get('/by-category', dateRangeValidation, ctrl.byCategory);
router.get('/trend', trendValidation, ctrl.monthlyTrend);
router.get('/budget', budgetValidation, ctrl.budgetStatus);

module.exports = router;
