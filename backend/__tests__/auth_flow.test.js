process.env.NODE_ENV = 'test';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../server');
const sequelize = require('../services/database_pg');
const Admin = require('../models/Admin');
const UserSession = require('../models/UserSession');
const Otp = require('../models/Otp');
const RevokedToken = require('../models/RevokedToken');

const schemaReady = app && app.schemaReady && typeof app.schemaReady.then === 'function'
  ? app.schemaReady
  : null;

describe('Admin auth end-to-end flow', () => {
  beforeAll(async () => {
    if (schemaReady) {
      await schemaReady;
    }
    // ensure DB models are loaded and synced for tests
    await sequelize.sync({ force: true });
    const pw = await bcrypt.hash('TestPass123!', 10);
    await Admin.create({ email: 'testadmin@example.com', passwordHash: pw });
  });

  afterAll(async () => {
    try { await sequelize.close(); } catch (e) {}
  });

  test('login -> issue OTP -> verify -> refresh -> logout', async () => {
    // Initiate login
    const loginRes = await request(app)
      .post('/api/admin/login')
      .send({ email: 'testadmin@example.com', password: 'TestPass123!' })
      .expect(200);

    expect(loginRes.body).toHaveProperty('success', true);
    expect(loginRes.body.data).toHaveProperty('requires2FA', true);
    // test env returns debugCode when email sending fails
    const debugCode = loginRes.body.data.debugCode || null;
    expect(loginRes.body.data).toHaveProperty('expiresAt');

    const otpRecord = await Otp.findOne({ where: { email: 'testadmin@example.com' }, order: [['createdAt', 'DESC']] });
    expect(otpRecord).toBeTruthy();
    expect(new Date(otpRecord.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const otpToUse = debugCode || '000000';
    if (debugCode) {
      const matches = await bcrypt.compare(otpToUse, otpRecord.codeHash);
      expect(matches).toBe(true);
      const msUntilExpiry = new Date(otpRecord.expiresAt).getTime() - Date.now();
      expect(msUntilExpiry).toBeGreaterThan(2 * 60 * 1000 - 5000); // ~3 minute TTL with small tolerance
    }

    const verifyRes = await request(app)
      .post('/api/admin/verify-otp')
      .send({ email: 'testadmin@example.com', otp: otpToUse })
      .expect(200);

    expect(verifyRes.body).toHaveProperty('success', true);
    let { token, refreshToken } = verifyRes.body.data;
    let activeRefreshToken = refreshToken;
    expect(typeof token).toBe('string');
    expect(typeof refreshToken).toBe('string');

    // refresh session
    const refreshRes = await request(app)
      .post('/api/admin/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(refreshRes.body).toHaveProperty('success', true);
    expect(refreshRes.body.data).toHaveProperty('token');
    token = refreshRes.body.data.token; // update to new token
    if (refreshRes.body.data && refreshRes.body.data.refreshToken) {
      activeRefreshToken = refreshRes.body.data.refreshToken;
    }

    // logout using refresh token
    const logoutRes = await request(app)
      .post('/api/admin/logout')
      .send({ refreshToken: activeRefreshToken })
      .expect(200);

    expect(logoutRes.body).toHaveProperty('success', true);

    // confirm session in DB is revoked
    const sessions = await UserSession.findAll({ where: { adminId: 1 } });
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    const revokedFound = sessions.some((session) => Boolean(session.revokedAt || session.revocationReason));
    expect(revokedFound).toBe(true);

    // confirm access token is blacklisted
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
    const blacklisted = await RevokedToken.findOne({ where: { tokenHash } });
    expect(blacklisted).toBeTruthy();
    expect(blacklisted.reason).toBe('logout');
  }, 20000);
});
