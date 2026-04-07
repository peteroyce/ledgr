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

router.get('/summary', dateRangeValidation, ctrl.summary);
router.get('/by-category', dateRangeValidation, ctrl.byCategory);
router.get('/trend', ctrl.monthlyTrend);
router.get('/budget', ctrl.budgetStatus);

module.exports = router;
