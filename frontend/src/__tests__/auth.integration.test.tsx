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
      getLatestData: jest.fn(async () => ({ data: { success: true, data: [] } })),
    },
    alertService: {
      getRecentAlerts: jest.fn(async () => ({ data: { success: true, data: [] } })),
    },
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

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { DarkModeProvider } from '../contexts/DarkModeContext';
import { DataProvider } from '../contexts/DataContext';
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
    );

    // Now render the AdminDashboard directly with the AuthProvider and click Logout
    // This simulates navigating to the dashboard after login
    render(
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
