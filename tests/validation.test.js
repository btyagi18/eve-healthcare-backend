const request = require('supertest');
const app = require('../src/app');

describe('Validation and authorization guards', () => {
  test('signup rejects invalid email', async () => {
    const res = await request(app).post('/auth/signup').send({
      name: 'Bhumika', email: 'not-an-email', password: 'password123'
    });
    expect(res.statusCode).toBe(400);
  });

  test('signup rejects weak password', async () => {
    const res = await request(app).post('/auth/signup').send({
      name: 'Bhumika', email: 'bhumika@example.com', password: '123'
    });
    expect(res.statusCode).toBe(400);
  });

  test('invalid bearer token is rejected', async () => {
    const res = await request(app)
      .get('/bookings')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.statusCode).toBe(401);
  });

  test('invalid mock payment status is rejected before database access', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: 1, email: 'test@example.com' }, process.env.JWT_SECRET);
    const res = await request(app)
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: 1, simulateStatus: 'PENDING' });
    expect(res.statusCode).toBe(400);
  });
});
