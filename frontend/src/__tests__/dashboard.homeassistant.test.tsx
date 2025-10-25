import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'admin', role: 'admin' },
    token: 'dummy-token',
    isAuthenticated: true,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

jest.mock('../contexts/DataContext', () => ({
  useData: () => ({
    latestSensorData: [],
    recentAlerts: [],
    isConnected: true,
    isLoading: false,
    refreshData: jest.fn(),
    lastFetchAt: null,
  }),
}));

jest.mock('../contexts/DarkModeContext', () => ({
  useDarkMode: () => ({
    isDarkMode: false,
    toggleDarkMode: jest.fn(),
  }),
}));

import Dashboard from '../pages/Dashboard';

test('Dashboard header renders for authenticated admin', () => {
  render(
    <MemoryRouter initialEntries={["/admin/dashboard"]}>
      <Routes>
        <Route path="/admin/dashboard" element={<Dashboard />} />
      </Routes>
    </MemoryRouter>
  );

  expect(screen.getByText(/User Dashboard/i)).toBeInTheDocument();
  expect(screen.getByText(/Sensors Live/i)).toBeInTheDocument();
});
