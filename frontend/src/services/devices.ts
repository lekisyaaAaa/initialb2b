import api from './api';

export const devicesService = {
  list: () => api.get('/devices'),
  heartbeat: (deviceId: string, metadata?: any) => api.post('/devices/heartbeat', { deviceId, metadata, timestamp: new Date().toISOString() })
};

export default devicesService;
