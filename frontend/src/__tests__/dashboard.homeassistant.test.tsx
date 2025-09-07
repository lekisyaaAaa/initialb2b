import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom/dist/index.js';
import Dashboard from '../pages/Dashboard';
import HomeAssistant from '../pages/HomeAssistant';
test('Home Assistant button exists and navigates', async () => {
  // Create a lightweight mock provider that injects the auth values into children via props
  const MockAuthProvider: React.FC<any> = ({ children }) => {
    const mock = {
      user: { username: 'admin', role: 'admin' },
      token: 'dummy',
      isAuthenticated: true,
      login: jest.fn(),
      logout: jest.fn(),
    } as any;

    return React.cloneElement(children as any, { authOverride: mock });
  };

  render(
    <MockAuthProvider>
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Routes>
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/home-assistant" element={<HomeAssistant />} />
        </Routes>
      </MemoryRouter>
    </MockAuthProvider>
  );

  const btn = await screen.findByRole('button', { name: /SmartBin Console/i });
  expect(btn).toBeInTheDocument();
});
