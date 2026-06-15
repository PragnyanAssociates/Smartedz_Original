// backend/tests/erp.test.js
const request = require('supertest');

// We point Supertest directly at your locally running server
// If your local server runs on a different port, change 3001 below.
const SERVER_URL = 'http://localhost:3001';

describe('SmartEdz ERP - Live API Tests', () => {

  // Test 1: Testing the Health Check route (Section 10 in your code)
  test('1. Health Check (GET /) should return system status', async () => {
    const response = await request(SERVER_URL).get('/');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('SmartEdz ERP');
    expect(response.body).toHaveProperty('time');
  });

  // Test 2: Testing the Authentication route (Section 1 in your code)
  test('2. Login (POST /api/login) should reject invalid credentials', async () => {
    const response = await request(SERVER_URL)
      .post('/api/login')
      .send({ email: 'fakeuser@smartedz.com', password: 'wrongpassword' });

    // Based on your index.js, an invalid login returns a 401 status
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Invalid credentials');
  });

});