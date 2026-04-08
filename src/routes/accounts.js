'use strict';

const router = require('express').Router();
const { body, param } = require('express-validator');
const authenticate = require('../middleware/auth');
const ctrl = require('../controllers/accountController');

router.use(authenticate);

const createValidation = [
  body('name').notEmpty().trim().withMessage('name is required'),
  body('type')
    .isIn(['checking', 'savings', 'credit', 'investment', 'cash'])
    .withMessage('type must be one of: checking, savings, credit, investment, cash'),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }).toUpperCase(),
  body('balance').optional().isNumeric(),
  body('institution').optional().isString().trim(),
];

const updateValidation = [
  body('name').optional().notEmpty().trim(),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }).toUpperCase(),
  body('institution').optional().isString().trim(),
  body('isActive').optional().isBoolean(),
];

const idValidation = [
  param('id').isMongoId().withMessage('id must be a valid MongoDB ObjectId'),
];

router.post('/', createValidation, ctrl.createAccount);
router.get('/', ctrl.getAccounts);
router.get('/:id', idValidation, ctrl.getAccount);
router.put('/:id', [...idValidation, ...updateValidation], ctrl.updateAccount);
router.delete('/:id', idValidation, ctrl.deleteAccount);

module.exports = router;
