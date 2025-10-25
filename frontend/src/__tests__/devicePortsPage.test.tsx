import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DevicePortsPage from '../pages/DevicePortsPage';
import { enumeratePorts, listSavedPorts, assignPort } from '../services/devicePorts';

jest.mock('../services/devicePorts', () => ({
  enumeratePorts: jest.fn(),
  listSavedPorts: jest.fn(),
  assignPort: jest.fn(),
}));

const mockEnumerate = enumeratePorts as jest.MockedFunction<typeof enumeratePorts>;
const mockListSaved = listSavedPorts as jest.MockedFunction<typeof listSavedPorts>;
const mockAssign = assignPort as jest.MockedFunction<typeof assignPort>;

describe('DevicePortsPage', () => {

  const renderWithRouter = (initialEntry = '/admin/devices/42/ports') => {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/admin/devices/:deviceId/ports" element={<DevicePortsPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    mockEnumerate.mockReset();
    mockListSaved.mockReset();
    mockAssign.mockReset();
  });

  test('renders enumeration results in table', async () => {
    mockEnumerate.mockResolvedValue({
      ports: [
        {
          port_name: 'UART0',
          port_type: 'UART',
          baud_rate: 9600,
          status: 'active',
          configured_at: '2025-10-25T12:00:00Z',
          metadata: { assignment: { sensor_id: 99, purpose: 'temperature' } },
        },
      ],
      meta: { source: 'live', devicePingable: true },
    });

    renderWithRouter();

    expect(await screen.findByText('UART0')).toBeInTheDocument();
    expect(screen.getByText('temperature')).toBeInTheDocument();
    expect(mockEnumerate).toHaveBeenCalledWith('42');
  });

  test('falls back to saved ports when enumeration fails', async () => {
    mockEnumerate.mockRejectedValue(new Error('offline'));
    mockListSaved.mockResolvedValue([
      {
        port_name: 'GPIO12',
        port_type: 'GPIO',
        status: 'inactive',
        configured_at: null,
        metadata: {},
      },
    ]);

    renderWithRouter();

    expect(await screen.findByText(/enumeration unavailable/i)).toBeInTheDocument();
    expect(screen.getByText('GPIO12')).toBeInTheDocument();
    expect(mockListSaved).toHaveBeenCalledWith('42');
  });

  test('submits port assignment from modal', async () => {
    mockEnumerate.mockResolvedValue({ ports: [], meta: {} });
  mockAssign.mockImplementation(async (_, body) => ({ ...body, port_name: 'UART1', port_type: 'UART' } as any));

    renderWithRouter();

    fireEvent.click(await screen.findByRole('button', { name: /new assignment/i }));

    fireEvent.change(screen.getByLabelText(/Port Name/i), { target: { value: 'UART1' } });
    fireEvent.change(screen.getByLabelText(/Baud Rate/i), { target: { value: '9600' } });
    fireEvent.change(screen.getByLabelText(/Sensor ID/i), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText(/Purpose/i), { target: { value: 'ph probe' } });

    fireEvent.click(screen.getByRole('button', { name: /save assignment/i }));

    await waitFor(() => {
      expect(mockAssign).toHaveBeenCalledWith('42', {
        port_name: 'UART1',
        port_type: 'UART',
        baud_rate: 9600,
        assignment: { sensor_id: 15, purpose: 'ph probe' },
      });
    });
  });
});
