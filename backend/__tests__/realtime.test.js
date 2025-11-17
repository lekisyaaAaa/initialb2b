jest.mock('../utils/logger', () => ({
  warn: jest.fn(),
}));

const { REALTIME_EVENTS, emitRealtime, getIoInstance } = require('../utils/realtime');

describe('realtime helper', () => {
  let ioMock;

  beforeEach(() => {
    ioMock = { emit: jest.fn() };
    global.io = undefined;
  });

  afterEach(() => {
    delete global.io;
  });

  it('emits primary and legacy events when available', () => {
    const payload = { id: 'alert-123' };
    const emitted = emitRealtime(REALTIME_EVENTS.ALERT_NEW, payload, { io: ioMock });

    expect(emitted).toBe(true);
    expect(ioMock.emit).toHaveBeenCalledWith('alert:new', payload);
    expect(ioMock.emit).toHaveBeenCalledWith('alert:trigger', payload);
    expect(ioMock.emit).toHaveBeenCalledTimes(2);
  });

  it('respects skipLegacy option', () => {
    emitRealtime(REALTIME_EVENTS.ACTUATOR_UPDATE, { key: 'pump' }, { io: ioMock, skipLegacy: true });

    expect(ioMock.emit).toHaveBeenCalledTimes(1);
    expect(ioMock.emit).toHaveBeenCalledWith('actuator:update', { key: 'pump' });
  });

  it('falls back to global io instance when none provided', () => {
    global.io = { emit: jest.fn() };
    const payload = { status: 'online' };
    const emitted = emitRealtime(REALTIME_EVENTS.DEVICE_STATUS, payload);

    expect(emitted).toBe(true);
    expect(global.io.emit).toHaveBeenCalledWith('device:status', payload);
  });

  it('prefers express-style container sockets over the container emitter', () => {
    const fakeIo = { emit: jest.fn() };
    const container = {
      emit: jest.fn(),
      get: jest.fn().mockReturnValue(fakeIo),
    };

    expect(getIoInstance(container)).toBe(fakeIo);
    expect(container.get).toHaveBeenCalledWith('io');
    expect(container.emit).not.toHaveBeenCalled();
  });

  it('returns false when descriptor or io are missing', () => {
    expect(emitRealtime(null, {}, { io: ioMock })).toBe(false);
    expect(emitRealtime(REALTIME_EVENTS.ALERT_CLEARED, {})).toBe(false);
  });
});
