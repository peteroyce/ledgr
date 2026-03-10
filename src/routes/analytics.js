'use strict';

const router = require('express').Router();
const authenticate = require('../middleware/auth');
const ctrl = require('../controllers/analyticsController');

router.use(authenticate);

router.get('/summary', ctrl.summary);
router.get('/by-category', ctrl.byCategory);
router.get('/trend', ctrl.monthlyTrend);
router.get('/budget', ctrl.budgetStatus);

module.exports = router;
