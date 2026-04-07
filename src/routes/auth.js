'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/authController');
const authenticate = require('../middleware/auth');

router.post('/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').notEmpty().trim(),
  ],
  ctrl.register
);

router.post('/login',
  [body('email').isEmail(), body('password').notEmpty()],
  ctrl.login
);

router.get('/me', authenticate, ctrl.getMe);

module.exports = router;
