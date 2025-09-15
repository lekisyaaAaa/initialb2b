import { SensorData, Alert } from '../types';

export const mockSensorData: SensorData[] = [
  {
    _id: 'mock-1',
    deviceId: 'DEVICE-001',
    temperature: 24.3,
    humidity: 55.2,
    moisture: 42.1,
    ph: 6.8,
    ec: 1.2,
    nitrogen: 45,
    phosphorus: 28,
    potassium: 180,
    waterLevel: 1,
    timestamp: new Date().toISOString(),
    status: 'normal',
    batteryLevel: 88,
    signalStrength: -67,
  },
  {
    _id: 'mock-2',
    deviceId: 'DEVICE-002',
    temperature: 22.1,
    humidity: 60.5,
    moisture: 35.4,
    ph: 7.2,
    ec: 0.9,
    nitrogen: 52,
    phosphorus: 32,
    potassium: 195,
    waterLevel: 0,
    timestamp: new Date().toISOString(),
    status: 'normal',
    batteryLevel: 74,
    signalStrength: -70,
  }
];

export const mockAlerts: Alert[] = [
  {
    _id: 'alert-1',
    type: 'temperature',
    severity: 'high',
    message: 'High temperature detected',
    deviceId: 'DEVICE-001',
  isResolved: false,
  createdAt: new Date().toISOString(),
  sensorData: mockSensorData[0],
  },
  {
    _id: 'alert-2',
    type: 'moisture',
    severity: 'medium',
    message: 'Low moisture warning',
    deviceId: 'DEVICE-002',
  isResolved: false,
  createdAt: new Date().toISOString(),
  sensorData: mockSensorData[1],
  }
];

export default {
  mockSensorData,
  mockAlerts,
};
