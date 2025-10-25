import api from './api';
import { DevicePort } from '../types';

export interface EnumeratePortsMeta {
  devicePingable?: boolean;
  commandId?: number | null;
  hardwareId?: string | null;
  source?: string;
}

export interface EnumeratePortsResponse {
  ports: DevicePort[];
  meta?: EnumeratePortsMeta;
}

export const enumeratePorts = async (deviceId: number | string): Promise<EnumeratePortsResponse> => {
  const res = await api.get(`/admin/devices/${deviceId}/ports/enumerate`);
  return {
    ports: Array.isArray(res.data?.ports) ? res.data.ports : [],
    meta: res.data?.meta,
  };
};

export const listSavedPorts = async (deviceId: number | string): Promise<DevicePort[]> => {
  const res = await api.get(`/admin/devices/${deviceId}/ports`);
  return Array.isArray(res.data?.ports) ? res.data.ports : [];
};

export const assignPort = async (deviceId: number | string, payload: Record<string, unknown>): Promise<DevicePort> => {
  const res = await api.post(`/admin/devices/${deviceId}/ports`, payload);
  if (res.data?.data) {
    return res.data.data as DevicePort;
  }
  return res.data as DevicePort;
};
