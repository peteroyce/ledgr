'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
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

router.post('/', createValidation, ctrl.createAccount);
router.get('/', ctrl.getAccounts);
router.get('/:id', ctrl.getAccount);
router.put('/:id', updateValidation, ctrl.updateAccount);
router.delete('/:id', ctrl.deleteAccount);

module.exports = router;


const CONFIG_13 = { timeout: 2300 };
