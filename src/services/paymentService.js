const crypto = require('crypto');
const pool = require('../config/db');

function generateTransactionId() {
  return `TXN_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
}

function paymentBookingStatus(paymentStatus) {
  return paymentStatus === 'SUCCESS' ? 'CONFIRMED' : 'FAILED';
}

async function processMockPayment({ bookingId, requestedStatus }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const bookingResult = await client.query(
      'SELECT id, user_id, amount, status FROM bookings WHERE id = $1 FOR UPDATE',
      [bookingId]
    );
    if (!bookingResult.rowCount) {
      const err = new Error('Booking not found.');
      err.status = 404;
      throw err;
    }

    const booking = bookingResult.rows[0];
    if (booking.status !== 'PENDING') {
      const err = new Error(`Payment is allowed only for PENDING bookings. Current status: ${booking.status}.`);
      err.status = 400;
      throw err;
    }

    const existingPayment = await client.query(
      'SELECT id FROM payments WHERE booking_id = $1',
      [bookingId]
    );
    if (existingPayment.rowCount) {
      const err = new Error('A payment attempt already exists for this booking.');
      err.status = 409;
      throw err;
    }

    const status = requestedStatus || 'SUCCESS';
    if (!['SUCCESS', 'FAILED'].includes(status)) {
      const err = new Error('simulateStatus must be SUCCESS or FAILED.');
      err.status = 400;
      throw err;
    }

    const transactionId = generateTransactionId();
    const paymentResult = await client.query(
      `INSERT INTO payments (booking_id, transaction_id, status, amount)
       VALUES ($1, $2, $3, $4)
       RETURNING id, booking_id, transaction_id, status, amount, created_at`,
      [bookingId, transactionId, status, booking.amount]
    );

    await client.query(
      'UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2',
      [paymentBookingStatus(status), bookingId]
    );

    await client.query('COMMIT');
    return paymentResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function processWebhook({ eventId, transactionId, bookingId, status }) {
  if (!eventId || !transactionId || !bookingId || !status) {
    const err = new Error('eventId, transactionId, bookingId and status are required.');
    err.status = 400;
    throw err;
  }
  if (!['SUCCESS', 'FAILED'].includes(status)) {
    const err = new Error('Webhook status must be SUCCESS or FAILED.');
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const duplicateEvent = await client.query(
      'SELECT id, booking_id, transaction_id, status FROM payments WHERE event_id = $1',
      [eventId]
    );
    if (duplicateEvent.rowCount) {
      const existing = duplicateEvent.rows[0];
      if (String(existing.booking_id) !== String(bookingId) ||
          (existing.transaction_id && existing.transaction_id !== transactionId) ||
          existing.status !== status) {
        const err = new Error('eventId has already been processed with different payment data.');
        err.status = 409;
        throw err;
      }
      await client.query('COMMIT');
      return { duplicate: true, payment: existing };
    }

    const bookingResult = await client.query(
      'SELECT id, amount, status FROM bookings WHERE id = $1 FOR UPDATE',
      [bookingId]
    );
    if (!bookingResult.rowCount) {
      const err = new Error('Booking not found.');
      err.status = 404;
      throw err;
    }

    const booking = bookingResult.rows[0];
    const expectedBookingStatus = paymentBookingStatus(status);
    const existingPayment = await client.query(
      'SELECT id, booking_id, transaction_id, event_id, status, amount FROM payments WHERE booking_id = $1 FOR UPDATE',
      [bookingId]
    );

    let payment;
    if (existingPayment.rowCount) {
      const current = existingPayment.rows[0];

      if (current.transaction_id && current.transaction_id !== transactionId) {
        const err = new Error('Transaction ID does not match the existing payment.');
        err.status = 409;
        throw err;
      }
      if (current.status !== status) {
        const err = new Error('Webhook status conflicts with the existing payment status.');
        err.status = 409;
        throw err;
      }
      if (booking.status !== expectedBookingStatus) {
        const err = new Error('Webhook status conflicts with the current booking state.');
        err.status = 409;
        throw err;
      }
      if (current.event_id && current.event_id !== eventId) {
        const err = new Error('A different webhook event is already recorded for this payment.');
        err.status = 409;
        throw err;
      }

      const result = await client.query(
        `UPDATE payments
         SET transaction_id = COALESCE(transaction_id, $1),
             event_id = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING id, booking_id, transaction_id, event_id, status, amount`,
        [transactionId, eventId, current.id]
      );
      payment = result.rows[0];
    } else {
      if (booking.status !== 'PENDING') {
        const err = new Error(`Cannot apply a new webhook to a ${booking.status} booking.`);
        err.status = 409;
        throw err;
      }

      const result = await client.query(
        `INSERT INTO payments (booking_id, transaction_id, event_id, status, amount)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, booking_id, transaction_id, event_id, status, amount`,
        [bookingId, transactionId, eventId, status, booking.amount]
      );
      payment = result.rows[0];

      await client.query(
        'UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2',
        [expectedBookingStatus, bookingId]
      );
    }

    await client.query('COMMIT');
    return { duplicate: false, payment };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      const duplicate = await client.query(
        'SELECT id, booking_id, transaction_id, status FROM payments WHERE event_id = $1',
        [eventId]
      );
      if (duplicate.rowCount) return { duplicate: true, payment: duplicate.rows[0] };
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { processMockPayment, processWebhook, paymentBookingStatus };
