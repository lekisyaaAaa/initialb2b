const request = require('supertest');
const express = require('express');

jest.mock('../middleware/auth', () => ({
  auth: (req, _res, next) => {
    req.user = { id: 1, role: 'admin', username: 'admin' };
    next();
  },
  adminOnly: (_req, _res, next) => next(),
}));

jest.mock('../models/Alert', () => ({
  sequelize: {},
  findAll: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
}));

const alertsRoute = require('../routes/alerts');
const Alert = require('../models/Alert');

describe('alerts summary and clear routes', () => {
  let app;
  let io;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    io = { emit: jest.fn() };
    app.set('io', io);
    app.use('/api/alerts', alertsRoute);
  });

  it('returns severity buckets mapped to critical/warning/info', async () => {
    Alert.findAll.mockResolvedValueOnce([
      { severity: 'critical', count: '2' },
      { severity: 'high', count: '3' },
      { severity: 'info', count: '1' },
    ]);

    const res = await request(app).get('/api/alerts/summary');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ critical: 2, warning: 3, info: 1 });
    expect(Alert.findAll).toHaveBeenCalled();
  });

  it('clears unresolved alerts and emits alert:trigger event', async () => {
    Alert.update.mockResolvedValueOnce([5]);

    const res = await request(app).delete('/api/alerts/clear');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, resolved: 5 });
    expect(Alert.update).toHaveBeenCalledWith(
      expect.objectContaining({ isResolved: true }),
      expect.objectContaining({ where: { isResolved: false } }),
    );
    expect(io.emit).toHaveBeenCalledWith(
      'alert:trigger',
      expect.objectContaining({ type: 'cleared', resolved: 5 }),
    );
  });
});
