import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('./components/OnboardingTour', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./components/OnboardingTour/tourConfig', () => []);

jest.mock('./contexts/AuthContext', () => ({
  __esModule: true,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { username: 'admin', role: 'admin' },
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

jest.mock('./contexts/DataContext', () => ({
  __esModule: true,
  DataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useData: () => ({
    latestSensorData: [],
    recentAlerts: [],
    isConnected: true,
    isLoading: false,
    refreshData: jest.fn(),
    lastFetchAt: null,
  }),
}));

jest.mock('./contexts/DarkModeContext', () => ({
  __esModule: true,
  DarkModeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDarkMode: () => ({
    isDarkMode: false,
    toggleDarkMode: jest.fn(),
  }),
}));

import App from './App';

test('renders application shell header', () => {
  render(<App />);

  expect(screen.getByText(/Environmental Monitoring System/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Contact/i })).toBeInTheDocument();
});
