const pool = require('../config/db');
const { processMockPayment, processWebhook } = require('../services/paymentService');

async function createPayment(req, res, next) {
  try {
    const { bookingId, simulateStatus } = req.body || {};
    if (!bookingId) return res.status(400).json({ message: 'bookingId is required.' });
    if (simulateStatus !== undefined && !['SUCCESS', 'FAILED'].includes(simulateStatus)) {
      return res.status(400).json({ message: 'simulateStatus must be SUCCESS or FAILED.' });
    }

    const ownership = await pool.query('SELECT id FROM bookings WHERE id = $1 AND user_id = $2', [bookingId, req.user.id]);
    if (!ownership.rowCount) {
      const exists = await pool.query('SELECT id FROM bookings WHERE id = $1', [bookingId]);
      if (exists.rowCount) return res.status(403).json({ message: 'You are not authorized to pay for this booking.' });
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const payment = await processMockPayment({ bookingId, requestedStatus: simulateStatus });
    res.status(201).json({ message: 'Mock payment processed.', payment });
  } catch (err) { next(err); }
}

async function webhook(req, res, next) {
  try {
    const { eventId, transactionId, bookingId, status } = req.body || {};
    const result = await processWebhook({ eventId, transactionId, bookingId, status });
    if (result.duplicate) {
      return res.status(200).json({ message: 'Webhook already processed.', duplicate: true, payment: result.payment });
    }
    res.status(200).json({ message: 'Webhook processed successfully.', duplicate: false, payment: result.payment });
  } catch (err) { next(err); }
}

async function getPayment(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT p.id, p.booking_id, p.transaction_id, p.event_id, p.status, p.amount, p.created_at, p.updated_at
       FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       WHERE p.id = $1 AND b.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Payment not found.' });
    res.json({ payment: result.rows[0] });
  } catch (err) { next(err); }
}

module.exports = { createPayment, webhook, getPayment };
