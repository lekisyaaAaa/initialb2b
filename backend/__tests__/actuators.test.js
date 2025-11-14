const request = require('supertest');
const express = require('express');
const actuatorsRoutes = require('../routes/actuators');
const { sendCommand } = require('../services/espController');

const app = express();
app.use('/api/actuators', actuatorsRoutes);

describe('Actuators API (deprecated)', () => {
  it('returns HTTP 410 for any actuator control attempts', async () => {
    const response = await request(app).post('/api/actuators/control');
    expect(response.status).toBe(410);
    expect(response.body).toMatchObject({
      success: false,
      code: 'actuators_deprecated',
    });
  });

  it('returns HTTP 410 for legacy log queries', async () => {
    const response = await request(app).get('/api/actuators/logs');
    expect(response.status).toBe(410);
    expect(response.body).toMatchObject({
      success: false,
      code: 'actuators_deprecated',
    });
  });

  it('rejects direct ESP32 command attempts', async () => {
    await expect(sendCommand('Water Pump', 'ON')).rejects.toThrow('Actuator command support has been retired');
  });
});
