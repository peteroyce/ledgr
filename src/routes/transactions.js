'use strict';

const router = require('express').Router();
const { body, param } = require('express-validator');
const mongoose = require('mongoose');
const authenticate = require('../middleware/auth');
const ctrl = require('../controllers/transactionController');

router.use(authenticate);

// Shared validation rules for create
const createValidation = [
  body('amount')
    .isFloat({ gt: 0 })
    .withMessage('amount must be a number greater than 0'),
  body('type')
    .isIn(['income', 'expense', 'transfer'])
    .withMessage('type must be income, expense, or transfer'),
  body('accountId')
    .notEmpty()
    .withMessage('accountId is required')
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('accountId must be a valid MongoDB ObjectId'),
  body('category').optional().isString().trim(),
  body('description').optional().isString().trim(),
  body('date').optional().isISO8601().withMessage('date must be a valid ISO 8601 date'),
];

// Shared validation rules for update (all fields optional)
const updateValidation = [
  body('amount')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('amount must be a number greater than 0'),
  body('type')
    .optional()
    .isIn(['income', 'expense', 'transfer'])
    .withMessage('type must be income, expense, or transfer'),
  body('accountId')
    .optional()
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('accountId must be a valid MongoDB ObjectId'),
  body('category').optional().isString().trim(),
  body('description').optional().isString().trim(),
  body('date').optional().isISO8601().withMessage('date must be a valid ISO 8601 date'),
];

const idValidation = [
  param('id').isMongoId().withMessage('id must be a valid MongoDB ObjectId'),
];

router.post('/', createValidation, ctrl.create);
router.get('/', ctrl.list);
router.get('/:id', idValidation, ctrl.getOne);
router.put('/:id', [...idValidation, ...updateValidation], ctrl.update);
router.delete('/:id', idValidation, ctrl.remove);

module.exports = router;
