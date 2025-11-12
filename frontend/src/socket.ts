import { io, ManagerOptions, SocketOptions } from 'socket.io-client';

const SOCKET_URL = 'https://vermilinks-backend.onrender.com';

const SOCKET_OPTIONS: Partial<ManagerOptions & SocketOptions> = {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000,
  withCredentials: true,
  timeout: 20000,
  path: '/socket.io',
};

export const createSocket = () => io(SOCKET_URL, SOCKET_OPTIONS);
export const socket = createSocket();
export { SOCKET_URL, SOCKET_OPTIONS };
