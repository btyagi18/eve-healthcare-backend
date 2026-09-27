const request = require('supertest');
const app = require('../src/app');

describe('Health endpoint', () => {
  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Validation without database dependency', () => {
  test('signup rejects missing fields', async () => {
    const res = await request(app).post('/auth/signup').send({ email: 'bad@example.com' });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/required/);
  });

  test('login rejects missing fields', async () => {
    const res = await request(app).post('/auth/login').send({});
    expect(res.statusCode).toBe(400);
  });
});
