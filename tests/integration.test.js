const fs = require('fs');
const path = require('path');
const request = require('supertest');

const runIntegration = Boolean(process.env.TEST_DATABASE_URL);
const describeIntegration = runIntegration ? describe : describe.skip;

describeIntegration('EVE Healthcare end-to-end lifecycle', () => {
  let app;
  let pool;
  let userToken;
  let secondUserToken;
  let bookingId;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    app = require('../src/app');
    pool = require('../src/config/db');

    const schema = fs.readFileSync(path.join(__dirname, '../sql/schema.sql'), 'utf8');
    const seed = fs.readFileSync(path.join(__dirname, '../sql/seed.sql'), 'utf8');
    await pool.query(schema);
    await pool.query('TRUNCATE payments, bookings, centre_tests, tests, diagnostic_centres, users RESTART IDENTITY CASCADE');
    await pool.query(seed);
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  test('signup + login + booking + payment success', async () => {
    const email = `eve_${Date.now()}@example.com`;
    const secondEmail = `eve_other_${Date.now()}@example.com`;

    let res = await request(app).post('/auth/signup').send({ name: 'Bhumika', email, password: 'password123' });
    expect(res.statusCode).toBe(201);
    res = await request(app).post('/auth/signup').send({ name: 'Other', email: secondEmail, password: 'password123' });
    expect(res.statusCode).toBe(201);

    res = await request(app).post('/auth/login').send({ email, password: 'password123' });
    expect(res.statusCode).toBe(200);
    userToken = res.body.token;

    res = await request(app).post('/auth/login').send({ email: secondEmail, password: 'password123' });
    secondUserToken = res.body.token;

    res = await request(app).post('/bookings').set('Authorization', `Bearer ${userToken}`).send({
      centreTestId: 2, appointmentDate: '2026-10-02', appointmentTime: '10:30'
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.booking.status).toBe('PENDING');
    expect(Number(res.body.booking.amount)).toBe(500);
    bookingId = res.body.booking.id;

    res = await request(app).post('/payments').set('Authorization', `Bearer ${secondUserToken}`).send({ bookingId });
    expect(res.statusCode).toBe(403);

    res = await request(app).post('/payments').set('Authorization', `Bearer ${userToken}`).send({ bookingId, simulateStatus: 'SUCCESS' });
    expect(res.statusCode).toBe(201);
    expect(res.body.payment.status).toBe('SUCCESS');

    res = await request(app).get(`/bookings/${bookingId}`).set('Authorization', `Bearer ${userToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.booking.status).toBe('CONFIRMED');
  });

  test('webhook is idempotent and conflicting duplicate is rejected', async () => {
    const newBooking = await request(app).post('/bookings').set('Authorization', `Bearer ${userToken}`).send({
      centreTestId: 2, appointmentDate: '2026-10-03', appointmentTime: '11:00'
    });
    expect(newBooking.statusCode).toBe(201);
    const id = newBooking.body.booking.id;

    let res = await request(app).post('/payments/webhook').send({
      eventId: `evt_${id}`, transactionId: `TXN_${id}`, bookingId: id, status: 'SUCCESS'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.duplicate).toBe(false);

    res = await request(app).post('/payments/webhook').send({
      eventId: `evt_${id}`, transactionId: `TXN_${id}`, bookingId: id, status: 'SUCCESS'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.duplicate).toBe(true);

    res = await request(app).post('/payments/webhook').send({
      eventId: `evt_${id}`, transactionId: `TXN_${id}`, bookingId: id, status: 'FAILED'
    });
    expect(res.statusCode).toBe(409);
  });

  test('failed payment moves booking to FAILED and a second payment is rejected', async () => {
    const created = await request(app).post('/bookings').set('Authorization', `Bearer ${userToken}`).send({
      centreTestId: 3, appointmentDate: '2026-10-04', appointmentTime: '12:00'
    });
    expect(created.statusCode).toBe(201);
    const id = created.body.booking.id;

    let res = await request(app).post('/payments').set('Authorization', `Bearer ${userToken}`).send({ bookingId: id, simulateStatus: 'FAILED' });
    expect(res.statusCode).toBe(201);
    expect(res.body.payment.status).toBe('FAILED');

    res = await request(app).post('/payments').set('Authorization', `Bearer ${userToken}`).send({ bookingId: id, simulateStatus: 'SUCCESS' });
    expect(res.statusCode).toBe(400);
  });
});
