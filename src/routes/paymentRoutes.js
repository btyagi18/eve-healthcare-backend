const router = require('express').Router();
const auth = require('../middleware/auth');
const { createPayment, webhook, getPayment } = require('../controllers/paymentController');
router.post('/webhook', webhook);
router.post('/', auth, createPayment);
router.get('/:id', auth, getPayment);
module.exports = router;
