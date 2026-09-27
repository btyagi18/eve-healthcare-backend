const pool = require('../config/db');

function isValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function isValidTime(time) {
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) return false;
  const [hour, minute, second = '00'] = time.split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;
}

async function createBooking(req, res, next) {
  const client = await pool.connect();
  try {
    const { centreTestId, appointmentDate, appointmentTime } = req.body || {};
    if (!centreTestId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ message: 'centreTestId, appointmentDate and appointmentTime are required.' });
    }
    if (!isValidDate(appointmentDate) || !isValidTime(appointmentTime)) {
      return res.status(400).json({ message: 'Use appointmentDate YYYY-MM-DD and appointmentTime HH:MM or HH:MM:SS.' });
    }

    await client.query('BEGIN');
    const centreTest = await client.query(
      `SELECT ct.id, ct.price, c.id AS centre_id, c.name AS centre_name,
              t.id AS test_id, t.name AS test_name
       FROM centre_tests ct
       JOIN diagnostic_centres c ON c.id = ct.centre_id
       JOIN tests t ON t.id = ct.test_id
       WHERE ct.id = $1`,
      [centreTestId]
    );
    if (!centreTest.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Centre-test combination not found.' });
    }

    const booking = await client.query(
      `INSERT INTO bookings (user_id, centre_test_id, appointment_date, appointment_time, amount, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')
       RETURNING id, user_id, centre_test_id, appointment_date, appointment_time, amount, status, created_at`,
      [req.user.id, centreTestId, appointmentDate, appointmentTime, centreTest.rows[0].price]
    );
    await client.query('COMMIT');

    return res.status(201).json({
      booking: {
        ...booking.rows[0],
        centre: { id: centreTest.rows[0].centre_id, name: centreTest.rows[0].centre_name },
        test: { id: centreTest.rows[0].test_id, name: centreTest.rows[0].test_name }
      }
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    next(err);
  } finally {
    client.release();
  }
}

async function listBookings(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT b.id, b.appointment_date, b.appointment_time, b.amount, b.status, b.created_at,
              c.id AS centre_id, c.name AS centre_name, c.location,
              t.id AS test_id, t.name AS test_name
       FROM bookings b
       JOIN centre_tests ct ON ct.id = b.centre_test_id
       JOIN diagnostic_centres c ON c.id = ct.centre_id
       JOIN tests t ON t.id = ct.test_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json({ bookings: result.rows });
  } catch (err) { next(err); }
}

async function getBooking(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT b.id, b.user_id, b.appointment_date, b.appointment_time, b.amount, b.status, b.created_at, b.updated_at,
              c.id AS centre_id, c.name AS centre_name, c.location,
              t.id AS test_id, t.name AS test_name,
              p.id AS payment_id, p.transaction_id, p.event_id, p.status AS payment_status
       FROM bookings b
       JOIN centre_tests ct ON ct.id = b.centre_test_id
       JOIN diagnostic_centres c ON c.id = ct.centre_id
       JOIN tests t ON t.id = ct.test_id
       LEFT JOIN payments p ON p.booking_id = b.id
       WHERE b.id = $1 AND b.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!result.rowCount) {
      const exists = await pool.query('SELECT id FROM bookings WHERE id = $1', [req.params.id]);
      if (exists.rowCount) return res.status(403).json({ message: 'You are not authorized to access this booking.' });
      return res.status(404).json({ message: 'Booking not found.' });
    }
    res.json({ booking: result.rows[0] });
  } catch (err) { next(err); }
}

async function cancelBooking(req, res, next) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT id, status FROM bookings WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [req.params.id, req.user.id]
    );
    if (!result.rowCount) {
      const exists = await client.query('SELECT id FROM bookings WHERE id = $1', [req.params.id]);
      await client.query('ROLLBACK');
      if (exists.rowCount) return res.status(403).json({ message: 'You are not authorized to modify this booking.' });
      return res.status(404).json({ message: 'Booking not found.' });
    }
    if (result.rows[0].status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Only PENDING bookings can be cancelled.' });
    }
    const updated = await client.query(
      `UPDATE bookings SET status = 'CANCELLED', updated_at = NOW()
       WHERE id = $1 RETURNING id, status, updated_at`,
      [req.params.id]
    );
    await client.query('COMMIT');
    res.json({ booking: updated.rows[0] });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    next(err);
  } finally { client.release(); }
}

module.exports = { createBooking, listBookings, getBooking, cancelBooking };
