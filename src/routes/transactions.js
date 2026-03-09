'use strict';

const router = require('express').Router();
const authenticate = require('../middleware/auth');
const ctrl = require('../controllers/transactionController');

router.use(authenticate);

router.post('/', ctrl.create);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
