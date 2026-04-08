'use strict';

const router = require('express').Router();
const { body, param } = require('express-validator');
const mongoose = require('mongoose');
const authenticate = require('../middleware/auth');
const ctrl = require('../controllers/recurringController');

router.use(authenticate);

const createValidation = [
  body('account')
    .notEmpty().withMessage('account is required')
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('account must be a valid MongoDB ObjectId'),
  body('type')
    .isIn(['income', 'expense'])
    .withMessage('type must be income or expense'),
  body('amount')
    .isFloat({ gt: 0 })
    .withMessage('amount must be a number greater than 0'),
  body('frequency')
    .isIn(['daily', 'weekly', 'monthly', 'yearly'])
    .withMessage('frequency must be one of: daily, weekly, monthly, yearly'),
  body('nextRunAt')
    .isISO8601().withMessage('nextRunAt must be a valid ISO 8601 date'),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }).toUpperCase(),
  body('category').optional().isString().trim(),
  body('description').optional().isString().trim(),
  body('dayOfMonth').optional().isInt({ min: 1, max: 31 }),
];

const updateValidation = [
  body('amount').optional().isFloat({ gt: 0 }),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }).toUpperCase(),
  body('category').optional().isString().trim(),
  body('description').optional().isString().trim(),
  body('frequency').optional().isIn(['daily', 'weekly', 'monthly', 'yearly']),
  body('dayOfMonth').optional().isInt({ min: 1, max: 31 }),
  body('nextRunAt').optional().isISO8601(),
  body('isActive').optional().isBoolean(),
];

const idValidation = [
  param('id').isMongoId().withMessage('id must be a valid MongoDB ObjectId'),
];

router.post('/', createValidation, ctrl.createRule);
router.get('/', ctrl.getRules);
router.get('/:id', idValidation, ctrl.getRule);
router.put('/:id', [...idValidation, ...updateValidation], ctrl.updateRule);
router.delete('/:id', idValidation, ctrl.deleteRule);

module.exports = router;
