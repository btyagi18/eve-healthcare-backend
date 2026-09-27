const request = require('supertest');
const app = require('../src/app');

describe('Protected booking endpoints', () => {
  test('POST /bookings rejects unauthenticated requests', async () => {
    const res = await request(app).post('/bookings').send({
      centreTestId: 1,
      appointmentDate: '2026-10-02',
      appointmentTime: '10:30'
    });
    expect(res.statusCode).toBe(401);
  });

  test('GET /bookings rejects unauthenticated requests', async () => {
    const res = await request(app).get('/bookings');
    expect(res.statusCode).toBe(401);
  });
});
