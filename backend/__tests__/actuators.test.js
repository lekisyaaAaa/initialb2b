const request = require('supertest');
const express = require('express');
const actuatorsRoutes = require('../routes/actuators');
const { auth, adminOnly } = require('../middleware/auth');

// Mock the middleware
jest.mock('../middleware/auth', () => ({
  auth: (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  },
  adminOnly: (req, res, next) => next()
}));

// Mock the ActuatorLog model
jest.mock('../models/ActuatorLog', () => ({
  create: jest.fn(),
  findAndCountAll: jest.fn()
}));

const ActuatorLog = require('../models/ActuatorLog');

const app = express();
app.use(express.json());
app.use('/api/actuators', actuatorsRoutes);

describe('Actuators API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/actuators/control', () => {
    it('should control actuator successfully', async () => {
      const mockLog = { id: 1 };
      ActuatorLog.create.mockResolvedValue(mockLog);

      const response = await request(app)
        .post('/api/actuators/control')
        .send({
          deviceId: 'ESP32_001',
          actuatorType: 'pump',
          action: 'on',
          reason: 'Test control'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('pump turned on successfully');
      expect(ActuatorLog.create).toHaveBeenCalledWith({
        deviceId: 'ESP32_001',
        actuatorType: 'pump',
        action: 'on',
        reason: 'Test control',
        triggeredBy: 'manual',
        userId: 1
      });
    });

    it('should return 400 for invalid actuator type', async () => {
      const response = await request(app)
        .post('/api/actuators/control')
        .send({
          deviceId: 'ESP32_001',
          actuatorType: 'invalid',
          action: 'on'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid action', async () => {
      const response = await request(app)
        .post('/api/actuators/control')
        .send({
          deviceId: 'ESP32_001',
          actuatorType: 'pump',
          action: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/actuators/logs', () => {
    it('should return actuator logs', async () => {
      const mockLogs = {
        rows: [
          {
            id: 1,
            deviceId: 'ESP32_001',
            actuatorType: 'pump',
            action: 'on',
            triggeredBy: 'manual',
            timestamp: '2025-01-01T00:00:00Z'
          }
        ],
        count: 1
      };
      ActuatorLog.findAndCountAll.mockResolvedValue(mockLogs);

      const response = await request(app)
        .get('/api/actuators/logs');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.logs).toHaveLength(1);
      expect(ActuatorLog.findAndCountAll).toHaveBeenCalled();
    });
  });
});
