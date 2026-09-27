const router = require('express').Router();
const auth = require('../middleware/auth');
const { createBooking, listBookings, getBooking, cancelBooking } = require('../controllers/bookingController');
router.use(auth);
router.post('/', createBooking);
router.get('/', listBookings);
router.get('/:id', getBooking);
router.patch('/:id/cancel', cancelBooking);
module.exports = router;
