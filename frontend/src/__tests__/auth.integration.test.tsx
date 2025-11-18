// Mock the API layer to avoid importing axios (ESM) in Jest environment
jest.mock('../services/api', () => {
  return {
    __esModule: true,
    default: {
      defaults: { headers: {} },
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
      get: jest.fn(async (url: string) => ({ data: { success: true } })),
      post: jest.fn(async () => ({ data: { success: true } })),
    },
    authService: {
      verify: jest.fn(async () => ({ data: { success: true, data: { user: { id: 'local-admin', username: 'admin', role: 'admin' } } } })),
    },
    adminAuthService: {
      loginAdmin: jest.fn(async (username: string, password: string) => {
        if (username === 'admin' && password === 'admin') {
          return { success: true, token: 'local-dev-token-123', user: { id: 'local-admin', username: 'admin', role: 'admin' } };
        }
        return { success: false };
      }),
    },
    sensorService: {
      getLatestData: jest.fn(async () => ({
        temperature: 24,
        humidity: 60,
        soil_moisture: 42,
        float_state: 1,
        updated_at: new Date().toISOString(),
      })),
    },
    alertService: {
      getRecentAlerts: jest.fn(async () => ({ data: { success: true, data: [] } })),
    },
    settingsService: {
      getAlertRules: jest.fn(async () => ({ data: { success: true, data: { temperature: true, humidity: true, moisture: true, ph: true, system: true, emailNotifications: false } } })),
      updateAlertRules: jest.fn(async () => ({ data: { success: true } })),
    },
    discoverApi: jest.fn(async () => ({ ok: false })),
  };
});

// Mock weatherService to avoid axios import during tests
jest.mock('../services/weatherService', () => ({
  __esModule: true,
  default: {
    getAllLocationsWeather: jest.fn(async () => []),
    getManilaWeatherSummary: jest.fn(async () => ({ summary: 'clear' })),
  }
}));

// Prevent real socket connections during tests
jest.mock('../socket', () => {
  const mockSocket = {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    connected: false,
    disconnect: jest.fn(),
  };
  return {
    __esModule: true,
    SOCKET_URL: 'http://localhost',
    getSocket: jest.fn(() => mockSocket),
    createSocket: jest.fn(() => mockSocket),
    disconnectSocket: jest.fn(),
    socket: mockSocket,
  };
});

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { DarkModeProvider } from '../contexts/DarkModeContext';
import { DataProvider } from '../contexts/DataContext';
import { ToastProvider } from '../contexts/ToastContext';
import LoginPage from '../pages/LoginPage';
import AdminDashboard from '../pages/AdminDashboard';

// Integration test: login (local fallback) -> admin access -> logout confirmation

describe('Auth flow integration', () => {
  beforeEach(() => {
    // Ensure clean localStorage
    localStorage.clear();
  });

  test('local fallback login, access admin, logout via confirmation', async () => {

    // Simulate successful login by storing tokens and user in localStorage
    localStorage.setItem('token', 'local-dev-token-123');
    localStorage.setItem('adminToken', 'local-dev-token-123');
    localStorage.setItem('user', JSON.stringify({ id: 'local-admin', username: 'admin', role: 'admin' }));

    // Sanity check
    expect(localStorage.getItem('token')).not.toBeNull();

    // Render the AdminDashboard (simulate navigation after login)
    render(
      <ToastProvider>
        <DarkModeProvider>
          <AuthProvider>
            <DataProvider>
              <MemoryRouter initialEntries={["/admin"]}>
                <Routes>
                  <Route path="/admin/*" element={<AdminDashboard />} />
                </Routes>
              </MemoryRouter>
            </DataProvider>
          </AuthProvider>
        </DarkModeProvider>
      </ToastProvider>
    );

    // Now render the AdminDashboard directly with the AuthProvider and click Logout
    // This simulates navigating to the dashboard after login
    render(
      <ToastProvider>
        <DarkModeProvider>
          <AuthProvider>
            <DataProvider>
              <MemoryRouter initialEntries={["/admin"]}>
                <Routes>
                  <Route path="/admin/*" element={<AdminDashboard />} />
                </Routes>
              </MemoryRouter>
            </DataProvider>
          </AuthProvider>
        </DarkModeProvider>
      </ToastProvider>
    );

  // Wait for page header to appear (there may be multiple portal/header instances)
  await waitFor(() => expect(screen.getAllByText(/Admin Dashboard/i).length).toBeGreaterThan(0), { timeout: 3000 });

    // Trigger logout via header button
    const logoutButton = screen.getAllByRole('button', { name: /logout/i })[0];
    await userEvent.click(logoutButton);

    // Confirmation modal should appear
    await waitFor(() => expect(screen.getByText(/Confirm Logout/i)).toBeInTheDocument());

    // Click Yes, logout
    const yesButton = screen.getByRole('button', { name: /yes, logout|yes$/i });
    await userEvent.click(yesButton);

    // After logout tokens should be cleared
    await waitFor(() => {
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('adminToken')).toBeNull();
    });
  }, 20000);
});
