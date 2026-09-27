const request = require('supertest');
const app = require('../src/app');

describe('Payment validation', () => {
  test('POST /payments rejects unauthenticated requests', async () => {
    const res = await request(app).post('/payments').send({ bookingId: 1 });
    expect(res.statusCode).toBe(401);
  });

  test('Webhook rejects missing fields', async () => {
    const res = await request(app).post('/payments/webhook').send({});
    expect(res.statusCode).toBe(400);
  });

  test('Webhook rejects invalid status', async () => {
    const res = await request(app).post('/payments/webhook').send({
      eventId: 'evt-test', transactionId: 'txn-test', bookingId: 1, status: 'PENDING'
    });
    expect(res.statusCode).toBe(400);
  });
});
